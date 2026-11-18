from alembic import op
import sqlalchemy as sa


revision = "20261116_01"
down_revision = "20261111_01"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())

    sangha_cols = {c["name"] for c in inspector.get_columns("sanghas")}
    if "created_at" not in sangha_cols:
        op.add_column("sanghas", sa.Column("created_at", sa.DateTime(), nullable=True))

    user_cols = {c["name"] for c in inspector.get_columns("users")}
    if "sangha_joined_at" not in user_cols:
        op.add_column("users", sa.Column("sangha_joined_at", sa.DateTime(), nullable=True))


def downgrade():
    inspector = sa.inspect(op.get_bind())

    user_cols = {c["name"] for c in inspector.get_columns("users")}
    if "sangha_joined_at" in user_cols:
        op.drop_column("users", "sangha_joined_at")

    sangha_cols = {c["name"] for c in inspector.get_columns("sanghas")}
    if "created_at" in sangha_cols:
        op.drop_column("sanghas", "created_at")