#include <iostream>
#include <string>
#include "CerveauPrincipal.h"

int main(int argc, char* argv[]) {
    if (argc != 3) {
        std::cerr << "Usage: moteur_principal.exe <config_path> <cours_path>" << std::endl;
        return 1;
    }

    CerveauPrincipal cerveau(argv[1], argv[2]);
    nlohmann::json rapport = cerveau.genererRapportQuotidien();
    
    std::cout << "SUCCESS_PRINCIPAL\n";
    std::cout << rapport.dump() << std::endl;

    return 0;
}
