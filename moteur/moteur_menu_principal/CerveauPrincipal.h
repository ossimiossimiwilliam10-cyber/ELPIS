#ifndef CERVEAU_PRINCIPAL_H
#define CERVEAU_PRINCIPAL_H

#include <string>
#include <vector>
#include "../../lib/json.hpp"

struct TacheDuJour {
    std::string matiere;
    std::string type; // "CM", "TD", "TP"
    std::string titre;
    int dureeMinutes = 0;
};

class CerveauPrincipal {
public:
    explicit CerveauPrincipal(const std::string& configPath, const std::string& coursPath);
    nlohmann::json genererRapportQuotidien();

private:
    std::string configPath;
    std::string coursPath;
    nlohmann::json configJson;
    nlohmann::json coursJson;

    bool loadData();
    std::string getTodayString();
};

#endif
