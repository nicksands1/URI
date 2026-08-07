"""Shared Postgres connection helper for the ingest scripts.

Two modes, same as lib/db.ts:
  - DATABASE_URL set (Supabase/Vercel convention): connect via that DSN.
    For loading data, point this at Supabase's DIRECT connection (port
    5432), not the pooler - bulk COPY/execute_values work is a poor fit
    for a transaction-mode pooler and this is a one-shot script, not a
    concurrent server.
  - Otherwise: discrete CI_DB_* vars - local dev default.
"""
from __future__ import annotations

import os

import psycopg2


def get_conn():
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return psycopg2.connect(database_url)
    return psycopg2.connect(
        host=os.environ.get("CI_DB_HOST", "localhost"),
        port=os.environ.get("CI_DB_PORT", "5432"),
        dbname=os.environ.get("CI_DB_NAME", "counter_intelligence"),
        user=os.environ.get("CI_DB_USER", "ci_app"),
        password=os.environ.get("CI_DB_PASSWORD", "ci_local_dev"),
    )
