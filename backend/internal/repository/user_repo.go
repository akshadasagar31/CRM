package repository

import (
	"context"
	"errors"
	"strings"

	"crm-backend-go/internal/database"
	"crm-backend-go/internal/models"

	"github.com/jackc/pgx/v5"
)

type UserRepository struct {
	db *database.DB
}

func NewUserRepository(db *database.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(ctx context.Context, name, email, hashedPassword string) (*models.User, error) {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	cleanName := strings.TrimSpace(name)

	var user models.User
	query := `
		INSERT INTO users (name, email, hashed_password, created_at)
		VALUES ($1, $2, $3, NOW())
		RETURNING id, email, name, hashed_password, created_at
	`
	err := r.db.Pool.QueryRow(ctx, query, cleanName, cleanEmail, hashedPassword).Scan(
		&user.ID, &user.Email, &user.Name, &user.HashedPassword, &user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	var user models.User
	query := `SELECT id, email, name, hashed_password, created_at FROM users WHERE LOWER(email) = $1`
	err := r.db.Pool.QueryRow(ctx, query, cleanEmail).Scan(
		&user.ID, &user.Email, &user.Name, &user.HashedPassword, &user.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetByID(ctx context.Context, id int) (*models.User, error) {
	var user models.User
	query := `SELECT id, email, name, hashed_password, created_at FROM users WHERE id = $1`
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&user.ID, &user.Email, &user.Name, &user.HashedPassword, &user.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) ListSummaries(ctx context.Context) ([]models.UserSummary, error) {
	query := `SELECT id, name, email FROM users ORDER BY name ASC`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.UserSummary
	for rows.Next() {
		var u models.UserSummary
		if err := rows.Scan(&u.ID, &u.Name, &u.Email); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	if users == nil {
		users = []models.UserSummary{}
	}
	return users, nil
}

func (r *UserRepository) UpdatePassword(ctx context.Context, email, hashedPassword string) error {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	query := `UPDATE users SET hashed_password = $1 WHERE LOWER(email) = $2`
	tag, err := r.db.Pool.Exec(ctx, query, hashedPassword, cleanEmail)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("user not found")
	}
	return nil
}
