#include <iostream>
#include <string>
#include "CerveauCours.h"

int main(int argc, char* argv[]) {
    if (argc == 3 && std::string(argv[1]) == "--update") {
        std::string incomingPath = argv[2];
        
        // 1. Lire le fichier entrant
        CerveauCours tempCerveau(incomingPath);
        if (!tempCerveau.loadConfig()) {
            std::cerr << "Erreur: Impossible de lire le fichier entrant: " << incomingPath << std::endl;
            return 1;
        }
        
        // 2. Transférer la configuration valide dans le Cerveau Officiel
        CerveauCours cerveauOfficiel("espoir_cours.json");
        cerveauOfficiel.loadConfig(); // Charger l'existant s'il y en a un
        
        cerveauOfficiel.setConfig(tempCerveau.getConfig()); 
        
        // 3. Sauvegarder
        if (!cerveauOfficiel.saveConfig()) {
            std::cerr << "Erreur: Impossible de sauvegarder espoir_cours.json" << std::endl;
            return 1;
        }
        
        std::cout << "SUCCESS_COURS" << std::endl;
        return 0;
    }
    
    std::cout << "Utilisation: moteur_cours.exe --update <fichier_json_temporaire>" << std::endl;
    return 1;
}
