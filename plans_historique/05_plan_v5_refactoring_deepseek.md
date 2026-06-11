# Projet Espoir - Compagnon d'Étude L2 Sciences pour l'Ingénieur

## Phase V5 : Refactoring Industriel (Cerveau Configuration) - Suite Audit DeepSeek

Suite à l'analyse critique de DeepSeek (qui avait relevé des failles d'encapsulation, de sécurité mémoire et d'atomicité sur notre Cerveau Configuration), nous avons mené une grande phase de refactoring.

### Problèmes identifiés par le 1er audit :
- `getConfig()` retournait une référence modifiable, cassant l'encapsulation.
- Aucune validation des données (heures négatives possibles, etc.).
- Risque de corruption du fichier JSON en cas de plantage pendant la sauvegarde.
- Absence d'un système de compilation standardisé (CMake).
- Absence de contrôle de version (Git).

### Actions Correctives Implémentées (V5) :

1. **Restauration de l'Encapsulation :**
   - Remplacement par `const AppConfig& getConfig() const;`
   - Obligation de passer par `setConfig()` pour toute mutation.

2. **Sécurité Mémoire et Initialisation :**
   - Valeurs par défaut directement dans la structure `AppConfig` (in-class initializers).
   - Constructeur du Cerveau rendu `explicit`.

3. **Validation et Anti-Corruption :**
   - `loadConfig()` parse désormais le fichier dans un objet temporaire. La mémoire n'est écrasée que si tout s'est bien passé.
   - Ajout de limitations strictes (ex: 8 heures max par jour, moyenne entre 0 et 20).

4. **Atomicité de la Sauvegarde :**
   - `saveConfig()` écrit d'abord dans un fichier `.tmp`.
   - Renommage atomique via `std::filesystem::rename` (avec fallback géré) uniquement si le fichier a bien été écrit.

5. **Infrastructure :**
   - Mise en place d'un `CMakeLists.txt` avec inclusion propre de la librairie JSON.
   - Initialisation du dépôt Git.

### Corrections Suite au 2e Audit (V5.1) :

L'auditeur DeepSeek a pointé de nouveaux détails pointus :
- L'inclusion `json.hpp` a été restaurée en mode chemin relatif statique par sécurité absolue pour l'analyse.
- La validation des données a été centralisée dans une méthode statique `sanitize()` pour éviter la duplication de code entre `loadConfig` et `setConfig`.
- La faille du renommage atomique avec suppression préalable `std::remove` sous Windows a été corrigée : l'écrasement via `std::filesystem::rename` se fait désormais de manière 100% atomique.
- Les valeurs par défaut lues dans `.cpp` se basent désormais dynamiquement sur la classe `AppConfig` pour ne plus jamais avoir de divergence.

**Statut :** Le Cerveau Configuration a reçu tous ses correctifs et compile avec succès. Le code est audité et figé.
