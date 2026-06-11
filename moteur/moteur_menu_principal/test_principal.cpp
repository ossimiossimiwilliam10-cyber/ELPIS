#include <iostream>
#include <cassert>
#include "CerveauPrincipal.h"

int main() {
    std::cout << "--- DEBUT TEST CerveauPrincipal ---" << std::endl;
    
    // Test basique avec les fichiers locaux
    CerveauPrincipal cerveau("espoir_config.json", "moteur/moteur_menu_cours/cours_data.json");
    
    std::string rapport = cerveau.genererRapportQuotidien();
    assert(!rapport.empty());
    
    std::cout << "Le rapport JSON a ete genere avec succes (taille: " << rapport.length() << " octets)." << std::endl;
    std::cout << "--- FIN TEST CerveauPrincipal (SUCCES) ---" << std::endl;
    return 0;
}
