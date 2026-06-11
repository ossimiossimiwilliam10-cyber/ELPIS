#include <iostream>
#include <string>
#include "CerveauConfig.h"

int main(int argc, char* argv[]) {
    if (argc == 3 && std::string(argv[1]) == "--update") {
        std::string incomingPath = argv[2];
        
        // 1. Lire le fichier entrant envoyé par Node.js
        CerveauConfig tempCerveau(incomingPath);
        if (!tempCerveau.loadConfig()) {
            std::cerr << "Erreur: Impossible de lire le fichier entrant: " << incomingPath << std::endl;
            return 1;
        }
        
        // 2. Transférer la configuration valide dans le Cerveau Officiel
        CerveauConfig cerveauOfficiel("espoir_config.json");
        // On charge l'existant au cas où, mais setConfig va l'écraser
        cerveauOfficiel.loadConfig(); 
        
        // C'est ici que toute la magie de validation C++ s'opère !
        cerveauOfficiel.setConfig(tempCerveau.getConfig()); 
        
        // 3. Sauvegarder de façon atomique
        if (!cerveauOfficiel.saveConfig()) {
            std::cerr << "Erreur: Impossible de sauvegarder espoir_config.json" << std::endl;
            return 1;
        }
        
        std::cout << "SUCCESS" << std::endl;
        return 0;
    }
    
    std::cout << "Utilisation: moteur_config.exe --update <fichier_json_temporaire>" << std::endl;
    return 1;
}
