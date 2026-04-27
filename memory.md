# Projet Verytis AGNTAPP - Structure & Architecture

## 🔑 Authentification & Multi-tenant
- **Table `clients`** : Tenants isolés.
- **Table `profiles`** : Liaison `auth.users` <-> `clients`.
  - **Rôles** : 
    - `owner` : Contrôle total + gestion users + suppression client.
    - `admin` : Config agents + lancement workflows.
    - `member` : Consultation + usage simple.
- **Signup Flow** : `handle_new_user()` crée automatiquement un Client, un Profil (Owner) et une Config par défaut.

## 🤖 Système de Flows IA
- **`client_flows`** : Flows activés pour le client (abstraction produit visible).
  - **`flow_key`** : Identifiant unique du flow (ex: `prospecting`).
  - **`status`** : `active`, `setup_required`, `paused`.
  - **`workflow_id`** : Lien vers la logique technique.
- **`agents`** : Catalogue global technique (Orchestrateur, Hunter, Qualifier, Enrichment, Copywriter, QA, etc.). Visible uniquement dans le détail d'un flow.
- **`agent_runs`** : Suivi des exécutions (input/output, tokens, coûts).
- **`agent_events`** : Steps internes (thought, decision, tool_call).
- **`agent_memory`** : Mémoire persistante (preferences, context, lessons) par scope (client, prospect, run).

## 🏗️ Workflows & Tâches
- **`workflows`** : Groupement logique (ex: Prospection).
- **`workflow_steps`** : Étapes d'exécution liées aux agents.
- **`tasks`** : File d'attente d'exécution pour les agents ou l'extension navigateur.

## 📊 Données Métier (CRM)
- **`companies`** : Entreprises cibles.
- **`prospects`** : Individus qualifiés.
- **`messages`** : Drafts et messages envoyés (multi-canal).
- **`conversations`** : Threads d'échanges avec les prospects.
- **`validations`** : Human-In-The-Loop (HITL) pour valider messages/prospects.

## 🛡️ Audit & Contrôle
- **`audit_logs`** : Journalisation de toutes les actions critiques.
- **`cost_logs`** : Suivi financier précis de la consommation LLM.
- **`daily_limits`** : Hard/Soft limits par client (coûts, messages, runs).
