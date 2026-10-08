package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"crm-backend-go/internal/database"
	"crm-backend-go/internal/models"

	"github.com/jackc/pgx/v5"
)

type PipelineRepository struct {
	db *database.DB
}

func NewPipelineRepository(db *database.DB) *PipelineRepository {
	return &PipelineRepository{db: db}
}

func (r *PipelineRepository) ListWithStages(ctx context.Context, workspaceID int) ([]models.Pipeline, error) {
	pipeQuery := `
		SELECT p.id, p.name, p.is_default, p.workspace_id, p.created_at,
		       COALESCE((SELECT COUNT(*) FROM deals d WHERE d.pipeline_id = p.id), 0) as deals_count,
		       COALESCE((SELECT SUM(d.value) FROM deals d WHERE d.pipeline_id = p.id), 0.0) as total_value
		FROM pipelines p
		WHERE p.workspace_id = $1
		ORDER BY p.is_default DESC, p.created_at ASC
	`
	rows, err := r.db.Pool.Query(ctx, pipeQuery, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pipelines []models.Pipeline
	for rows.Next() {
		var p models.Pipeline
		var isDefInt int
		if err := rows.Scan(
			&p.ID, &p.Name, &isDefInt, &p.WorkspaceID, &p.CreatedAt,
			&p.DealsCount, &p.TotalValue,
		); err != nil {
			return nil, err
		}
		p.IsDefault = (isDefInt == 1)
		pipelines = append(pipelines, p)
	}

	for i := range pipelines {
		stages, err := r.ListStagesByPipelineID(ctx, pipelines[i].ID)
		if err != nil {
			return nil, err
		}
		pipelines[i].Stages = stages
	}

	if pipelines == nil {
		pipelines = []models.Pipeline{}
	}
	return pipelines, nil
}

func (r *PipelineRepository) ListStagesByPipelineID(ctx context.Context, pipelineID int) ([]models.DealStage, error) {
	stageQuery := `
		SELECT s.id, s.pipeline_id, s.name, s.stage_order, s.probability, s.color, s.is_won, s.is_lost,
		       COALESCE(s.is_active, true) as is_active, s.created_at,
		       COALESCE((SELECT COUNT(*) FROM deals d WHERE d.stage_id = s.id), 0) as deals_count,
		       COALESCE((SELECT SUM(d.value) FROM deals d WHERE d.stage_id = s.id), 0.0) as total_value
		FROM deal_stages s
		WHERE s.pipeline_id = $1
		ORDER BY s.stage_order ASC, s.id ASC
	`
	rows, err := r.db.Pool.Query(ctx, stageQuery, pipelineID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stages []models.DealStage
	for rows.Next() {
		var s models.DealStage
		var wonInt, lostInt int
		if err := rows.Scan(
			&s.ID, &s.PipelineID, &s.Name, &s.StageOrder, &s.Probability, &s.Color, &wonInt, &lostInt,
			&s.IsActive, &s.CreatedAt,
			&s.DealsCount, &s.TotalValue,
		); err != nil {
			return nil, err
		}
		s.IsWon = (wonInt == 1)
		s.IsLost = (lostInt == 1)
		stages = append(stages, s)
	}

	if stages == nil {
		stages = []models.DealStage{}
	}
	return stages, nil
}

func (r *PipelineRepository) GetByID(ctx context.Context, id int, workspaceID int) (*models.Pipeline, error) {
	query := `
		SELECT p.id, p.name, p.is_default, p.workspace_id, p.created_at,
		       COALESCE((SELECT COUNT(*) FROM deals d WHERE d.pipeline_id = p.id), 0) as deals_count,
		       COALESCE((SELECT SUM(d.value) FROM deals d WHERE d.pipeline_id = p.id), 0.0) as total_value
		FROM pipelines p
		WHERE p.id = $1 AND p.workspace_id = $2
	`
	var p models.Pipeline
	var isDefInt int
	err := r.db.Pool.QueryRow(ctx, query, id, workspaceID).Scan(
		&p.ID, &p.Name, &isDefInt, &p.WorkspaceID, &p.CreatedAt,
		&p.DealsCount, &p.TotalValue,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	p.IsDefault = (isDefInt == 1)

	stages, err := r.ListStagesByPipelineID(ctx, p.ID)
	if err != nil {
		return nil, err
	}
	p.Stages = stages
	return &p, nil
}

func (r *PipelineRepository) Create(ctx context.Context, input models.PipelineCreateInput, workspaceID int) (*models.Pipeline, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("pipeline name is required")
	}

	isDefInt := 0
	if input.IsDefault {
		isDefInt = 1
		// Clear previous default
		_, _ = r.db.Pool.Exec(ctx, "UPDATE pipelines SET is_default = 0 WHERE workspace_id = $1", workspaceID)
	}

	var p models.Pipeline
	query := `
		INSERT INTO pipelines (name, is_default, workspace_id, created_at)
		VALUES ($1, $2, $3, NOW())
		RETURNING id, name, is_default, workspace_id, created_at
	`
	err := r.db.Pool.QueryRow(ctx, query, name, isDefInt, workspaceID).Scan(
		&p.ID, &p.Name, &isDefInt, &p.WorkspaceID, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	p.IsDefault = (isDefInt == 1)

	// Create 3 basic default stages for any new pipeline
	defaultStages := []models.DealStageCreateInput{
		{Name: "Discovery", StageOrder: 1, Probability: 20, Color: "#3B82F6"},
		{Name: "Proposal", StageOrder: 2, Probability: 60, Color: "#F59E0B"},
		{Name: "Closed Won", StageOrder: 3, Probability: 100, Color: "#10B981", IsWon: true},
	}
	for _, st := range defaultStages {
		_, _ = r.CreateStage(ctx, p.ID, st)
	}

	stages, _ := r.ListStagesByPipelineID(ctx, p.ID)
	p.Stages = stages
	return &p, nil
}

func (r *PipelineRepository) Update(ctx context.Context, id int, name string, isDefault *bool, workspaceID int) (*models.Pipeline, error) {
	existing, err := r.GetByID(ctx, id, workspaceID)
	if err != nil || existing == nil {
		return nil, errors.New("pipeline not found")
	}

	cleanName := strings.TrimSpace(name)
	if cleanName != "" {
		existing.Name = cleanName
	}

	isDefInt := 0
	if existing.IsDefault {
		isDefInt = 1
	}
	if isDefault != nil {
		if *isDefault {
			isDefInt = 1
			_, _ = r.db.Pool.Exec(ctx, "UPDATE pipelines SET is_default = 0 WHERE workspace_id = $1", workspaceID)
		} else {
			isDefInt = 0
		}
	}

	_, err = r.db.Pool.Exec(ctx,
		"UPDATE pipelines SET name = $1, is_default = $2 WHERE id = $3 AND workspace_id = $4",
		existing.Name, isDefInt, id, workspaceID,
	)
	if err != nil {
		return nil, err
	}

	return r.GetByID(ctx, id, workspaceID)
}

func (r *PipelineRepository) Delete(ctx context.Context, id int, workspaceID int) error {
	// Check deal count
	var dealCount int
	err := r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM deals WHERE pipeline_id = $1", id).Scan(&dealCount)
	if err == nil && dealCount > 0 {
		return fmt.Errorf("cannot delete pipeline with %d active deals", dealCount)
	}

	// Cannot delete only default pipeline
	var totalPipelines int
	_ = r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM pipelines WHERE workspace_id = $1", workspaceID).Scan(&totalPipelines)
	if totalPipelines <= 1 {
		return errors.New("cannot delete the only pipeline")
	}

	_, err = r.db.Pool.Exec(ctx, "DELETE FROM pipelines WHERE id = $1 AND workspace_id = $2", id, workspaceID)
	return err
}

func (r *PipelineRepository) CreateStage(ctx context.Context, pipelineID int, input models.DealStageCreateInput) (*models.DealStage, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("stage name is required")
	}

	color := input.Color
	if color == "" {
		color = "#0D9488"
	}

	wonInt := 0
	if input.IsWon {
		wonInt = 1
	}
	lostInt := 0
	if input.IsLost {
		lostInt = 1
	}
	active := true
	if input.IsActive != nil {
		active = *input.IsActive
	}

	order := input.StageOrder
	if order <= 0 {
		_ = r.db.Pool.QueryRow(ctx, "SELECT COALESCE(MAX(stage_order), 0) + 1 FROM deal_stages WHERE pipeline_id = $1", pipelineID).Scan(&order)
	}

	var s models.DealStage
	query := `
		INSERT INTO deal_stages (pipeline_id, name, stage_order, probability, color, is_won, is_lost, is_active, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		RETURNING id, pipeline_id, name, stage_order, probability, color, is_won, is_lost, is_active, created_at
	`
	err := r.db.Pool.QueryRow(ctx, query,
		pipelineID, name, order, input.Probability, color, wonInt, lostInt, active,
	).Scan(
		&s.ID, &s.PipelineID, &s.Name, &s.StageOrder, &s.Probability, &s.Color, &wonInt, &lostInt, &s.IsActive, &s.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	s.IsWon = (wonInt == 1)
	s.IsLost = (lostInt == 1)
	return &s, nil
}

func (r *PipelineRepository) UpdateStage(ctx context.Context, stageID int, input models.DealStageUpdateInput) (*models.DealStage, error) {
	var s models.DealStage
	var wonInt, lostInt int
	err := r.db.Pool.QueryRow(ctx,
		"SELECT id, pipeline_id, name, stage_order, probability, color, is_won, is_lost, COALESCE(is_active, true), created_at FROM deal_stages WHERE id = $1",
		stageID,
	).Scan(
		&s.ID, &s.PipelineID, &s.Name, &s.StageOrder, &s.Probability, &s.Color, &wonInt, &lostInt, &s.IsActive, &s.CreatedAt,
	)
	if err != nil {
		return nil, errors.New("stage not found")
	}

	if input.Name != nil && strings.TrimSpace(*input.Name) != "" {
		s.Name = strings.TrimSpace(*input.Name)
	}
	if input.StageOrder != nil {
		s.StageOrder = *input.StageOrder
	}
	if input.Probability != nil {
		s.Probability = *input.Probability
	}
	if input.Color != nil && strings.TrimSpace(*input.Color) != "" {
		s.Color = strings.TrimSpace(*input.Color)
	}
	if input.IsWon != nil {
		if *input.IsWon {
			wonInt = 1
		} else {
			wonInt = 0
		}
	}
	if input.IsLost != nil {
		if *input.IsLost {
			lostInt = 1
		} else {
			lostInt = 0
		}
	}
	if input.IsActive != nil {
		s.IsActive = *input.IsActive
	}

	_, err = r.db.Pool.Exec(ctx,
		`UPDATE deal_stages
		 SET name = $1, stage_order = $2, probability = $3, color = $4, is_won = $5, is_lost = $6, is_active = $7
		 WHERE id = $8`,
		s.Name, s.StageOrder, s.Probability, s.Color, wonInt, lostInt, s.IsActive, stageID,
	)
	if err != nil {
		return nil, err
	}

	s.IsWon = (wonInt == 1)
	s.IsLost = (lostInt == 1)
	return &s, nil
}

func (r *PipelineRepository) DeleteStage(ctx context.Context, stageID int) error {
	var dealCount int
	err := r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM deals WHERE stage_id = $1", stageID).Scan(&dealCount)
	if err == nil && dealCount > 0 {
		return fmt.Errorf("cannot delete stage with %d active deals", dealCount)
	}

	_, err = r.db.Pool.Exec(ctx, "DELETE FROM deal_stages WHERE id = $1", stageID)
	return err
}

func (r *PipelineRepository) ReorderStages(ctx context.Context, pipelineID int, stageIDs []int) error {
	for order, id := range stageIDs {
		_, _ = r.db.Pool.Exec(ctx, "UPDATE deal_stages SET stage_order = $1 WHERE id = $2 AND pipeline_id = $3", order+1, id, pipelineID)
	}
	return nil
}

func (r *PipelineRepository) GetStageByID(ctx context.Context, stageID int) (*models.DealStage, error) {
	var s models.DealStage
	var wonInt, lostInt int
	err := r.db.Pool.QueryRow(ctx,
		"SELECT id, pipeline_id, name, stage_order, probability, color, is_won, is_lost, COALESCE(is_active, true), created_at FROM deal_stages WHERE id = $1",
		stageID,
	).Scan(
		&s.ID, &s.PipelineID, &s.Name, &s.StageOrder, &s.Probability, &s.Color, &wonInt, &lostInt, &s.IsActive, &s.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	s.IsWon = (wonInt == 1)
	s.IsLost = (lostInt == 1)
	return &s, nil
}
