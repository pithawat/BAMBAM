# Needs: go, sqlc, goose, golangci-lint (go install … — see docs/shared/00-platform.md Demo).
# Windows without make: run the command after each target by hand.
-include .env
export

.PHONY: run test test-db lint sqlc migrate-up migrate-down migrate-status migrate-new db-up dev-session

run:
	APP_ENV=development go run ./cmd/api | cmd:$env:APP_ENV = "development"; go run ./cmd/api

test:
	go test ./... -race

# Postgres integration tests need a migrated database (docker compose db, port 5433):
#   make test-db && TEST_DATABASE_URL=postgres://bambam:bambam@localhost:5433/bambam_test?sslmode=disable make test
TEST_DATABASE_URL_LOCAL = postgres://bambam:bambam@localhost:5433/bambam_test?sslmode=disable
test-db:
	docker compose -f ../docker-compose.yml exec -T db psql -U bambam -d bambam -c "CREATE DATABASE bambam_test" || true
	goose -dir db/migrations postgres "$(TEST_DATABASE_URL_LOCAL)" up

lint:
	golangci-lint run

sqlc:
	sqlc generate

# migrate-up:
# 	goose -dir db/migrations postgres "$(DATABASE_URL)" up

# migrate-down:
# 	goose -dir db/migrations postgres "$(DATABASE_URL)" down

# migrate-status:
# 	goose -dir db/migrations postgres "$(DATABASE_URL)" status

# # make migrate-new name=<module>_<change>
# migrate-new:
# 	goose -dir db/migrations -s=false create $(name) sql

# db-up:
# 	docker compose -f ../docker-compose.yml up -d db

# # prints a session token for a demo user (dev/UAT only): make dev-session role=technician
# dev-session:
# 	APP_ENV=development go run ./cmd/devsession -role $(or $(role),employee)
