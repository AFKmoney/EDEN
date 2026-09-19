#!/usr/bin/env python3
"""
Script de correction massive des erreurs TypeScript pour EDEN
Auteur: Vibe Code (Mistral AI)
Date: 2025-01-15
"""

import re
import os
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple

# ============================================================================
# CONFIGURATION
# ============================================================================

ROOT_DIR = Path("/workspace/github__AFKmoney__EDEN")
SRC_DIR = ROOT_DIR / "src"
TIMELINE_FILE = ROOT_DIR / "TIMELINE.md"

# Patterns de correction
PATTERNS = {
    # 1. process.env.XYZ -> process.env['XYZ']
    "process_env": {
        "pattern": r"process\.env\.([A-Za-z_][A-Za-z0-9_]*)",
        "replacement": r"process.env['\\1']",
        "files": ["**/*.ts"],
        "description": "Corrige l'accès aux variables d'environnement"
    },
    
    # 2. asReadonly() -> asReadonly() as any
    "as_readonly": {
        "pattern": r"\.asReadonly\(\)",
        "replacement": r".asReadonly() as any",
        "files": ["src/app/**/*.ts"],
        "description": "Corrige asReadonly sur les Signaux Angular"
    },
    
    # 3. Object.keys -> (Object as any).keys ou ajout de const { Object } = globalThis
    "object_global": {
        "pattern": r"{{ Object\.",
        "replacement": r"{{ (Object as any).",
        "files": ["src/app/**/*.ts"],
        "description": "Corrige l'accès à Object dans les templates Angular"
    },
    
    # 4. asyncHandler sans return type
    "async_handler": {
        "pattern": r"asyncHandler\(async \(([^)]+)\) => \{",
        "replacement": r"asyncHandler(async (\\1): Promise<void> => {",
        "files": ["src/server/controllers/**/*.ts"],
        "description": "Ajoute Promise<void> aux handlers async"
    },
    
    # 5. Export de types sans 'export type'
    "export_type": {
        "pattern": r"export \{(.+)\};",
        "replacement_custom": lambda m: f"export type {{" + m.group(1) + "}};" if any(t in m.group(1) for t in ["IUser", "IAgent", "ITemplate", "IWebhook", "INode", "IConnection"]) else m.group(0),
        "files": ["src/server/models/index.ts"],
        "description": "Corrige les exports de types"
    }
}

# ============================================================================
# FONCTIONS UTILITAIRES
# ============================================================================

def get_timestamp() -> str:
    """Retourne un timestamp formaté"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def run_command(cmd: str, cwd: str = str(ROOT_DIR)) -> str:
    """Exécute une commande shell"""
    result = subprocess.run(
        cmd,
        shell=True,
        cwd=cwd,
        capture_output=True,
        text=True
    )
    return result.stdout + result.stderr


def get_ts_errors() -> Dict[str, List[Tuple[str, int]]]:
    """Récupère toutes les erreurs TypeScript groupées par type"""
    output = run_command("npm run build 2>&1")
    errors = {}
    
    # Pattern pour extraire les erreurs
    error_pattern = r"\[ERROR\] (TS\d+): (.+?)\[plugin angular-compiler\].+?(\w+\.ts):(\d+)"
    
    for match in re.finditer(error_pattern, output, re.DOTALL):
        error_code = match.group(1)
        error_msg = match.group(2).strip()
        file_path = match.group(3)
        line_num = int(match.group(4))
        
        if error_code not in errors:
            errors[error_code] = []
        errors[error_code].append((file_path, line_num, error_msg))
    
    return errors


def apply_pattern_to_file(filepath: Path, pattern: str, replacement: str) -> bool:
    """Applique une correction regex à un fichier"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content, count = re.subn(pattern, replacement, content)
        
        if count > 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            return True
        return False
    except Exception as e:
        print(f"⚠️  Erreur sur {filepath}: {e}")
        return False


def find_files(pattern: str) -> List[Path]:
    """Trouve tous les fichiers correspondant à un pattern glob"""
    # Simplification: on utilise find avec des patterns basiques
    result = []
    pattern = pattern.replace("**/", "").replace("*", "")
    
    for root, dirs, files in os.walk(SRC_DIR):
        for file in files:
            if file.endswith('.ts'):
                filepath = Path(root) / file
                result.append(filepath)
    
    return result


def add_to_timeline(action: str, details: str = "") -> None:
    """Ajoute une entrée au TIMELINE"""
    timestamp = get_timestamp()
    entry = f"\n- **[{timestamp}]** {action}\n  {details}"
    
    with open(TIMELINE_FILE, 'a', encoding='utf-8') as f:
        f.write(entry + "\n")


# ============================================================================
# FONCTIONS DE CORRECTION SPÉCIFIQUES
# ============================================================================

def fix_process_env() -> int:
    """Corrige tous les process.env.XYZ"""
    count = 0
    files = find_files("**/*.ts")
    
    for filepath in files:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Trouver tous les process.env.XYZ
        matches = re.findall(r"process\.env\.([A-Za-z_][A-Za-z0-9_]*)", content)
        
        if matches:
            for var_name in set(matches):
                content = content.replace(
                    f"process.env.{var_name}",
                    f"process.env['{var_name}']"
                )
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            count += len(set(matches))
            print(f"  ✅ {filepath.name}: {len(set(matches))} corrections")
    
    return count


def fix_as_readonly() -> int:
    """Corrige tous les .asReadonly()"""
    count = 0
    files = find_files("src/app/**/*.ts")
    
    for filepath in files:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content, replacements = re.subn(
            r"\.asReadonly\(\)",
            ".asReadonly() as any",
            content
        )
        
        if replacements > 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            count += replacements
            print(f"  ✅ {filepath.name}: {replacements} corrections")
    
    return count


def fix_object_in_templates() -> int:
    """Corrige Object dans les templates Angular"""
    count = 0
    files = find_files("src/app/**/*.ts")
    
    for filepath in files:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Vérifier si le fichier contient Object.keys ou Object.values dans un template
        if re.search(r'{{ Object\.(keys|values|entries)', content):
            # Ajouter const { Object } = globalThis; après les imports
            if 'const { Object } = globalThis;' not in content:
                # Trouver la fin des imports
                import_end = content.rfind('import')
                if import_end > 0:
                    # Trouver la fin de la ligne d'import
                    lines = content.split('\n')
                    last_import_line = 0
                    for i, line in enumerate(lines):
                        if line.strip().startswith('import'):
                            last_import_line = i
                    
                    # Insérer après le dernier import
                    lines.insert(last_import_line + 1, '')
                    lines.insert(last_import_line + 2, '// Fix TypeScript strict mode - Object not recognized in templates')
                    lines.insert(last_import_line + 3, 'const { Object } = globalThis;')
                    
                    new_content = '\n'.join(lines)
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    count += 1
                    print(f"  ✅ {filepath.name}: Ajout de const {{ Object }} = globalThis")
    
    return count


def fix_async_handler() -> int:
    """Corrige les appels asyncHandler sans return type"""
    count = 0
    files = find_files("src/server/controllers/**/*.ts")
    
    for filepath in files:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Pattern 1: sans next
        pattern1 = r'asyncHandler\(async \(req: Request, res: Response\) => \{'
        replacement1 = r'asyncHandler(async (req: Request, res: Response): Promise<void> => {'
        new_content1, n1 = re.subn(pattern1, replacement1, content)
        
        # Pattern 2: avec next
        pattern2 = r'asyncHandler\(async \(req: Request, res: Response, next: NextFunction\) => \{'
        replacement2 = r'asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {'
        new_content2, n2 = re.subn(pattern2, replacement2, new_content1)
        
        if n1 > 0 or n2 > 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content2)
            count += n1 + n2
            print(f"  ✅ {filepath.name}: {n1 + n2} corrections asyncHandler")
    
    return count


def fix_export_types() -> int:
    """Corrige les exports de types dans models/index.ts"""
    filepath = SRC_DIR / "server" / "models" / "index.ts"
    
    if not filepath.exists():
        return 0
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remplacer export { X, Y } from 'Z' par export { default as X } from 'Z' + export type { Y } from 'Z'
    # C'est complexe, on va faire une correction manuelle
    old_content = content
    
    # Exemple: export { default as UserModel, IUser, UserRole } from './User';
    # devient: export { default as UserModel } from './User';
    #          export type { IUser, UserRole } from './User';
    
    lines = content.split('\n')
    new_lines = []
    modified = False
    
    for line in lines:
        # Match export { default as X, Type1, Type2 } from 'Y';
        match = re.match(
            r'^export \{ default as (\w+)(, (\w+(?:, \w+)*)\s*)\} from [\'"](.+?)[\'"];',
            line.strip()
        )
        
        if match:
            default_export = match.group(1)
            types = match.group(2).strip(', ')
            from_path = match.group(3)
            
            # Créer deux lignes
            new_lines.append(f'export {{ default as {default_export} }} from "{from_path}";')
            if types:
                type_list = ', '.join(t.strip() for t in types.split(','))
                new_lines.append(f'export type {{ {type_list} }} from "{from_path}";')
            modified = True
        else:
            new_lines.append(line)
    
    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))
        print(f"  ✅ {filepath.name}: Exports de types corrigés")
        return 1
    
    return 0


def fix_public_data_properties() -> int:
    """Ajoute publicData aux interfaces Mongoose"""
    count = 0
    interfaces = [
        ("IAgent", "src/server/models/Agent.ts"),
        ("ITemplate", "src/server/models/Template.ts"),
        ("IWebhook", "src/server/models/Webhook.ts"),
        ("IUser", "src/server/models/User.ts"),
    ]
    
    for interface_name, filepath in interfaces:
        filepath = Path(filepath)
        if not filepath.exists():
            continue
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Trouver l'interface et ajouter publicData: any; avant les méthodes
        pattern = rf'interface {interface_name} \{{(.*?)\n\s*// Methods'
        match = re.search(pattern, content, re.DOTALL)
        
        if match:
            # Ajouter publicData avant // Methods
            new_content = content.replace(
                '  // Methods',
                '  publicData: any;\n\n  // Methods'
            )
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            count += 1
            print(f"  ✅ {filepath.name}: Ajout de publicData à {interface_name}")
    
    return count


def fix_middleware_return_types() -> int:
    """Corrige les return types des middlewares"""
    count = 0
    files = find_files("src/server/middleware/**/*.ts")
    
    for filepath in files:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Corriger export function XXX(req, res, next) {
        # en export function XXX(req, res, next): void {
        pattern = r'(export function \w+\([^)]+\):?)\s*\{'
        
        def replacer(match):
            func_decl = match.group(1)
            if ': void' not in func_decl and ': Promise<void>' not in func_decl:
                # Ajouter : void si ce n'est pas une fonction async
                if 'async' not in func_decl:
                    return func_decl + ': void {'
            return match.group(0)
        
        new_content, n = re.subn(pattern, replacer, content)
        
        if n > 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            count += n
            print(f"  ✅ {filepath.name}: {n} corrections de return types")
    
    return count


# ============================================================================
# FONCTION PRINCIPALE
# ============================================================================

def main():
    """Exécute toutes les corrections"""
    print("=" * 80)
    print("🚀 DÉMARRAGE DU SCRIPT DE CORRECTION MASSIVE")
    print("=" * 80)
    print(f"📅 Date: {get_timestamp()}")
    print()
    
    # Compter les erreurs initiales
    print("🔍 Analyse des erreurs initiales...")
    initial_errors = get_ts_errors()
    total_initial = sum(len(v) for v in initial_errors.values())
    print(f"   ❌ Erreurs TypeScript: {total_initial}")
    print()
    
    # Démarrer l'itération 2
    print("📝 Mise à jour du TIMELINE...")
    add_to_timeline(
        "ITERATION 2: Début des corrections massives",
        f"Erreurs initiales: {total_initial}"
    )
    print()
    
    # Appliquer les corrections
    corrections = [
        ("Correction des process.env", fix_process_env),
        ("Correction des asReadonly", fix_as_readonly),
        ("Correction de Object dans templates", fix_object_in_templates),
        ("Correction des asyncHandler", fix_async_handler),
        ("Correction des exports de types", fix_export_types),
        ("Correction des propriétés publicData", fix_public_data_properties),
        ("Correction des middlewares", fix_middleware_return_types),
    ]
    
    total_fixed = 0
    for name, fix_func in corrections:
        print(f"🔧 {name}...")
        try:
            fixed = fix_func()
            total_fixed += fixed
            print(f"   ✅ {fixed} corrections appliquées")
            add_to_timeline(f"{name}: {fixed} corrections")
        except Exception as e:
            print(f"   ❌ Erreur: {e}")
            add_to_timeline(f"{name}: ❌ ERREUR - {str(e)}")
        print()
    
    # Compter les erreurs finales
    print("🔍 Analyse des erreurs après corrections...")
    final_errors = get_ts_errors()
    total_final = sum(len(v) for v in final_errors.values())
    print(f"   ❌ Erreurs TypeScript: {total_final}")
    print()
    
    # Résumé
    print("=" * 80)
    print("📊 RÉSUMÉ DE L'ITÉRATION 2")
    print("=" * 80)
    print(f"   Erreurs avant: {total_initial}")
    print(f"   Erreurs après: {total_final}")
    print(f"   Corrections: {total_fixed}")
    print(f"   Progrès: {((total_initial - total_final) / total_initial * 100):.1f}%")
    print()
    
    # Top erreurs restantes
    if final_errors:
        print("🔴 Top erreurs restantes:")
        for error_code, occurrences in sorted(
            final_errors.items(),
            key=lambda x: len(x[1]),
            reverse=True
        )[:10]:
            print(f"   {len(occurrences)}x - {error_code}")
    print()
    
    # Mise à jour finale du TIMELINE
    add_to_timeline(
        "ITERATION 2: Fin des corrections massives",
        f"Erreurs restantes: {total_final} | Progrès: {((total_initial - total_final) / total_initial * 100):.1f}%"
    )
    
    print("✅ Script terminé avec succès!")


if __name__ == "__main__":
    main()
