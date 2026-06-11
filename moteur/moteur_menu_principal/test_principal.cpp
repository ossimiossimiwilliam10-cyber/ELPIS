#include <iostream>
#include <fstream>
#include <cassert>
#include "CerveauPrincipal.h"
#include "../../lib/json.hpp"

// Fonction utilitaire pour créer un fichier de test
void creerFichierDeTest(const std::string& path, const nlohmann::json& contenu) {
    std::ofstream f(path);
    f << contenu.dump(4);
    f.close();
}

void testOrchestrateur() {
    std::cout << "--- DEBUT TEST CerveauPrincipal ---" << std::endl;
    
    // 1. Préparation des données de test
    std::string testConfigPath = "test_config.json";
    std::string testCoursPath = "test_cours.json";

    nlohmann::json mockConfig = {
        {"bedtime", "23:00"},
        {"maxStudyHoursPerDay", 8},
        {"wakeUpTime", "07:00"},
        {"fixedCommitments", {
            {
                {"title", "Cours Math"},
                {"dayOfWeek", "Tous les jours"}, // Pour être sûr que ça matche
                {"startTime", "08:00"},
                {"endTime", "10:00"}  // 120 minutes de durée
            }
        }}
    };

    nlohmann::json mockCours = {
        {"semestres", {
            {
                {"nom", "Semestre 1"},
                {"ues", {
                    {
                        {"nom", "UE1 Math"},
                        {"matieres", {
                            {
                                {"nom", "Algèbre"},
                                {"listeCM", {
                                    {
                                        {"titre", "CM1 Espaces Vectoriels"},
                                        {"jActuel", 0},
                                        {"derniereRevision", ""} // Jamais révisé = doit ressortir
                                    }
                                }},
                                {"listeTD", nlohmann::json::array()},
                                {"listeTP", nlohmann::json::array()}
                            }
                        }}
                    }
                }}
            }
        }}
    };

    creerFichierDeTest(testConfigPath, mockConfig);
    creerFichierDeTest(testCoursPath, mockCours);

    // 2. Exécution de l'orchestrateur
    CerveauPrincipal cerveau(testConfigPath, testCoursPath);
    std::string rapportStr = cerveau.genererRapportQuotidien();
    
    assert(!rapportStr.empty());
    
    // 3. Validation fine
    nlohmann::json rapport = nlohmann::json::parse(rapportStr);
    
    // Vérifier que le temps dispo est correct : 8h = 480 min. Moins 120m (fixed) = 360 min.
    assert(rapport.contains("tempsDispoMin"));
    assert(rapport["tempsDispoMin"] == 360);

    // Vérifier la Tâche CM
    assert(rapport.contains("tachesDuJour"));
    assert(rapport["tachesDuJour"].size() == 1);
    assert(rapport["tachesDuJour"][0]["type"] == "CM");
    assert(rapport["tachesDuJour"][0]["titre"] == "CM1 Espaces Vectoriels");
    assert(rapport["tachesDuJour"][0]["dureeMin"] == 120);

    // Nettoyage
    std::remove(testConfigPath.c_str());
    std::remove(testCoursPath.c_str());

    std::cout << "Tous les tests unitaires ont reussi avec succes !" << std::endl;
    std::cout << "--- FIN TEST CerveauPrincipal ---" << std::endl;
}

int main() {
    testOrchestrateur();
    return 0;
}
