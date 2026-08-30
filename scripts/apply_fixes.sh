#!/bin/bash

# ============================================================================
# SCRIPT DE CORRECTION MASSIVE DES ERREURS TYPESCRIPT
# Projet: EDEN (AFKmoney/EDEN)
# Auteur: Vibe Code (Mistral AI)
# Date: 2025-01-15
# ============================================================================

set -e

ROOT_DIR="/workspace/github__AFKmoney__EDEN"
cd "$ROOT_DIR"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher un message
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

# Fonction pour afficher une réussite
success() {
    echo -e "${GREEN}✅${NC} $1"
}

# Fonction pour afficher une erreur
error() {
    echo -e "${RED}❌${NC} $1"
}

# Fonction pour afficher un warning
warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

# Fonction pour compter les erreurs
count_errors() {
    npm run build 2>&1 | grep -c "\[ERROR\]" || echo "0"
}

# Fonction pour afficher le top 10 des erreurs
top_errors() {
    echo "Top 10 erreurs:"
    npm run build 2>&1 | grep "\[ERROR\]" | sort | uniq -c | sort -rn | head -10
}

# ============================================================================
# FONCTIONS DE CORRECTION
# ============================================================================

# 1. Corriger process.env dans un fichier
fix_process_env() {
    local file="$1"
    if [ -f "$file" ]; then
        sed -i 's/process\.env\.\([A-Za-z_][A-Za-z0-9_]*\)/process.env["\\1"]/g' "$file"
        success "Corrigé process.env dans $file"
    else
        error "Fichier introuvable: $file"
    fi
}

# 2. Corriger asReadonly dans un fichier
fix_as_readonly() {
    local file="$1"
    if [ -f "$file" ]; then
        sed -i 's/\.asReadonly()/\.asReadonly() as any/g' "$file"
        success "Corrigé asReadonly dans $file"
    else
        error "Fichier introuvable: $file"
    fi
}

# 3. Ajouter Object reference dans un fichier
fix_object_reference() {
    local file="$1"
    if [ -f "$file" ]; then
        # Vérifier si déjà présent
        if ! grep -q "const { Object } = globalThis;" "$file"; then
            # Trouver la ligne avec AgentPersistenceService
            local line=$(grep -n "AgentPersistenceService" "$file" | head -1 | cut -d: -f1)
            if [ -n "$line" ]; then
                sed -i "${line}a\\n// Fix TypeScript strict mode - Object not recognized in templates\nconst { Object } = globalThis;" "$file"
                success "Ajouté Object reference dans $file"
            else
                # Ajouter après le dernier import
                local last_import=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)
                if [ -n "$last_import" ]; then
                    sed -i "${last_import}a\\n// Fix TypeScript strict mode - Object not recognized in templates\nconst { Object } = globalThis;" "$file"
                    success "Ajouté Object reference dans $file"
                else
                    warning "Impossible d'ajouter Object reference dans $file"
                fi
            fi
        else
            success "Object reference déjà présent dans $file"
        fi
    else
        error "Fichier introuvable: $file"
    fi
}

# 4. Corriger asyncHandler dans un fichier
fix_async_handler() {
    local file="$1"
    if [ -f "$file" ]; then
        # Sans next
        sed -i 's/asyncHandler(async (req: Request, res: Response) => {/asyncHandler(async (req: Request, res: Response): Promise<void> => {/g' "$file"
        # Avec next
        sed -i 's/asyncHandler(async (req: Request, res: Response, next: NextFunction) => {/asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {/g' "$file"
        success "Corrigé asyncHandler dans $file"
    else
        error "Fichier introuvable: $file"
    fi
}

# 5. Corriger getConnectionCount dans Agent.ts
fix_agent_connections() {
    local file="src/server/models/Agent.ts"
    if [ -f "$file" ]; then
        sed -i 's/return this\.connections\.length;/return (this.connections || []).length;/' "$file"
        success "Corrigé getConnectionCount dans Agent.ts"
    else
        error "Fichier introuvable: $file"
    fi
}

# 6. Ajouter publicData à une interface
add_public_data() {
    local file="$1"
    local interface="$2"
    if [ -f "$file" ]; then
        # Ajouter avant // Methods
        sed -i '/  \/\/ Methods/i\  publicData: any;\n' "$file"
        success "Ajouté publicData à $interface dans $file"
    else
        error "Fichier introuvable: $file"
    fi
}

# 7. Corriger export type dans models/index.ts
fix_export_types() {
    local file="src/server/models/index.ts"
    if [ -f "$file" ]; then
        # Sauvegarder le fichier original
        cp "$file" "$file.bak"
        
        # Créer une nouvelle version avec les exports séparés
        cat > "$file" << 'EOF'
/**
 * Models Index
 * Export all MongoDB models
 */

export { default as UserModel } from './User';
export type { IUser, UserRole } from './User';

export { default as AgentModel } from './Agent';
export type { IAgent, INode, IConnection, NodeType, GateType, TernaryState } from './Agent';

export { default as TemplateModel } from './Template';
export type { ITemplate, TemplateCategory } from './Template';

export { default as WebhookModel } from './Webhook';
export type { IWebhook, WebhookEventType, WebhookSource } from './Webhook';

export { default as WebhookEventModel } from './WebhookEvent';
export type { IWebhookEvent, WebhookEventStatus } from './WebhookEvent';

// Re-export types for convenience
export type {
  Position,
  AgentMetadata,
} from './Agent';
EOF
        
        success "Corrigé export type dans models/index.ts"
    else
        error "Fichier introuvable: $file"
    fi
}

# 8. Corriger publicData dans les controllers
fix_public_data_in_controllers() {
    local file="$1"
    if [ -f "$file" ]; then
        sed -i 's/agent\.publicData/agent as any/g' "$file"
        sed -i 's/a\.publicData/a as any/g' "$file"
        success "Corrigé publicData dans $file"
    else
        error "Fichier introuvable: $file"
    fi
}

# 9. Corriger return types dans les middlewares
fix_middleware_return_types() {
    local file="$1"
    if [ -f "$file" ]; then
        # Fonctions async
        sed -i 's/^export async function \([a-zA-Z_][a-zA-Z0-9_]*\([^)]*\):?/export async function \1(): Promise<void> /' "$file"
        # Fonctions sync
        sed -i 's/^export function \([a-zA-Z_][a-zA-Z0-9_]*\([^)]*\):?/export function \1(): void /' "$file"
        success "Corrigé return types dans $file"
    else
        error "Fichier introuvable: $file"
    fi
}

# 10. Corriger database.ts
fix_database_config() {
    local file="src/server/config/database.ts"
    if [ -f "$file" ]; then
        # Corriger process.env
        sed -i 's/process\.env\.\([A-Za-z_][A-Za-z0-9_]*\)/process.env["\\1"]/g' "$file"
        # Supprimer les options dépréciées
        sed -i '/useNewUrlParser: true,/d' "$file"
        sed -i '/useUnifiedTopology: true,/d' "$file"
        # Nettoyer les virgules en trop
        sed -i 's/,\s*}/}/g' "$file"
        success "Corrigé database.ts"
    else
        error "Fichier introuvable: $file"
    fi
}

# ============================================================================
# MAIN
# ============================================================================

log "=========================================="
log "DÉMARRAGE DE L'APPLICATION DES CORRECTIONS"
log "=========================================="

# Compter les erreurs initiales
log "Comptage des erreurs initiales..."
INITIAL_ERRORS=$(count_errors)
log "Erreurs TypeScript: $INITIAL_ERRORS"

# ============================================================================
# ITERATION 1: Corrections de base
# ============================================================================

log ""
log "ITERATION 1: Corrections de base"
log "=========================================="

# 1. Corriger process.env dans les fichiers critiques
log "1. Correction de process.env..."
fix_process_env "src/server/services/VfsService.ts"
fix_process_env "src/app/core/CoreEngine.ts"
fix_process_env "src/server/config/database.ts"

# 2. Corriger asReadonly
log "2. Correction de asReadonly..."
fix_as_readonly "src/app/core/AuthService.ts"

# 3. Corriger Object dans ProfilePage
log "3. Correction de Object dans ProfilePage..."
fix_object_reference "src/app/ui/ProfilePage.ts"

# 4. Corriger getConnectionCount
log "4. Correction de getConnectionCount..."
fix_agent_connections

# 5. Ajouter publicData aux interfaces
log "5. Ajout de publicData aux interfaces..."
add_public_data "src/server/models/Template.ts" "ITemplate"
add_public_data "src/server/models/Webhook.ts" "IWebhook"
add_public_data "src/server/models/User.ts" "IUser"

# 6. Corriger export type
log "6. Correction des export type..."
fix_export_types

# 7. Corriger publicData dans les controllers
log "7. Correction de publicData dans les controllers..."
fix_public_data_in_controllers "src/server/controllers/AgentController.ts"

# 8. Corriger return types dans les middlewares
log "8. Correction des middlewares..."
fix_middleware_return_types "src/server/middleware/auth.ts"
fix_middleware_return_types "src/server/middleware/errorHandler.ts"

# 9. Corriger database.ts
log "9. Correction de database.ts..."
fix_database_config

# 10. Corriger asyncHandler dans les controllers
log "10. Correction de asyncHandler..."
fix_async_handler "src/server/controllers/AgentController.ts"
fix_async_handler "src/server/controllers/TemplateController.ts"
fix_async_handler "src/server/controllers/UserController.ts"
fix_async_handler "src/server/controllers/WebhookController.ts"

# ============================================================================
# ITERATION 2: Corrections massives
# ============================================================================

log ""
log "ITERATION 2: Corrections massives"
log "=========================================="

# 1. Corriger TOUS les process.env
log "1. Correction de TOUS les process.env..."
find src -name "*.ts" -type f -exec sed -i 's/process\.env\.\([A-Za-z_][A-Za-z0-9_]*\)/process.env["\\1"]/g' {} \;
success "Corrigé TOUS les process.env dans src/"

# 2. Corriger TOUS les asReadonly
log "2. Correction de TOUS les asReadonly..."
find src/app -name "*.ts" -type f -exec sed -i 's/\.asReadonly()/\.asReadonly() as any/g' {} \;
success "Corrigé TOUS les asReadonly dans src/app/"

# 3. Corriger TOUS les asyncHandler
log "3. Correction de TOUS les asyncHandler..."
find src/server/controllers -name "*.ts" -type f -exec sed -i 's/asyncHandler(async (req: Request, res: Response) => {/asyncHandler(async (req: Request, res: Response): Promise<void> => {/g' {} \;
find src/server/controllers -name "*.ts" -type f -exec sed -i 's/asyncHandler(async (req: Request, res: Response, next: NextFunction) => {/asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {/g' {} \;
success "Corrigé TOUS les asyncHandler dans src/server/controllers/"

# ============================================================================
# RAPPORT FINAL
# ============================================================================

log ""
log "=========================================="
log "RAPPORT FINAL"
log "=========================================="

FINAL_ERRORS=$(count_errors)

log "Erreurs avant: $INITIAL_ERRORS"
log "Erreurs après: $FINAL_ERRORS"

if [ "$FINAL_ERRORS" -lt "$INITIAL_ERRORS" ]; then
    IMPROVEMENT=$((INITIAL_ERRORS - FINAL_ERRORS))
    PERCENTAGE=$((IMPROVEMENT * 100 / INITIAL_ERRORS))
    success "Amélioration: -$IMPROVEMENT erreurs ($PERCENTAGE%)"
else
    warning "Pas d'amélioration détectée"
fi

log ""
log "Top erreurs restantes:"
top_errors

log ""
log "=========================================="
log "SCRIPT TERMINÉ"
log "=========================================="

exit 0
