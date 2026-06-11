#ifndef CERVEAU_PRINCIPAL_H
#define CERVEAU_PRINCIPAL_H

#include <string>
#include "../../lib/json.hpp"
#include "../moteur_menu_configuration/CerveauConfig.h"
#include "../moteur_menu_cours/CerveauCours.h"

class CerveauPrincipal {
public:
    explicit CerveauPrincipal(const std::string& configPath, const std::string& coursPath);
    nlohmann::json genererRapportQuotidien();

private:
    std::string configPath;
    std::string coursPath;

    std::string getTodayString() const;
};

#endif
