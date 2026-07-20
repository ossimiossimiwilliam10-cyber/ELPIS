import fs from 'fs';
import path from 'path';

/**
 * Lit un fichier JSON de manière sécurisée.
 * @param filePath Chemin absolu vers le fichier JSON
 * @param defaultData Données par défaut si le fichier n'existe pas
 */
export const readJsonFile = <T>(filePath: string, defaultData: T): T => {
    try {
        if (!fs.existsSync(filePath)) {
            // Créer le fichier avec les données par défaut
            writeJsonFile(filePath, defaultData);
            return defaultData;
        }
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data) as T;
    } catch (error) {
        console.error(`Erreur de lecture du fichier ${filePath}:`, error);
        return defaultData;
    }
};

/**
 * Écrit dans un fichier JSON de manière atomique pour éviter la corruption de données.
 * @param filePath Chemin absolu vers le fichier JSON
 * @param data Données à écrire
 */
export const writeJsonFile = <T>(filePath: string, data: T): void => {
    const tempFilePath = `${filePath}.tmp`;
    
    try {
        // 1. Écrire dans le fichier temporaire
        const stringifiedData = JSON.stringify(data, null, 2);
        fs.writeFileSync(tempFilePath, stringifiedData, 'utf-8');

        // 2. Remplacer le fichier original par le fichier temporaire (Atomique sur la plupart des OS)
        fs.renameSync(tempFilePath, filePath);
    } catch (error) {
        console.error(`Erreur lors de l'écriture atomique de ${filePath}:`, error);
        
        // Fallback: Si renameSync échoue (ex: partitions différentes), on utilise copyFileSync
        try {
            if (fs.existsSync(tempFilePath)) {
                fs.copyFileSync(tempFilePath, filePath);
                fs.unlinkSync(tempFilePath);
            }
        } catch (fallbackError) {
            console.error(`Erreur critique : le fallback a échoué pour ${filePath}`, fallbackError);
        }
    }
};
