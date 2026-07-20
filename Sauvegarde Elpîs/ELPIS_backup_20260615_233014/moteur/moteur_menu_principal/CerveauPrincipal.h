#ifndef CERVEAU_PRINCIPAL_H
#define CERVEAU_PRINCIPAL_H

#include <string>
#include "../moteur_menu_configuration/CerveauConfig.h"
#include "../moteur_menu_cours/CerveauCours.h"

class CerveauPrincipal {
public:
    explicit CerveauPrincipal(const std::string& configPath, const std::string& coursPath);
    std::string genererRapportQuotidien();

private:
    std::string configPath;
    std::string coursPath;

    std::string getTodayString() const;
    std::string getDayOfWeekString() const;
};

#endif
