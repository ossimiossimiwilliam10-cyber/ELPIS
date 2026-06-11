#include "CerveauPrincipal.h"
#include <iostream>
#include <algorithm>
#include <ctime>
#include <iomanip>
#include <sstream>

CerveauPrincipal::CerveauPrincipal(const std::string& configPath, const std::string& coursPath) 
    : configPath(configPath), coursPath(coursPath) {}

std::string CerveauPrincipal::getTodayString() const {
    auto t = std::time(nullptr);
    auto tm = *std::localtime(&t);
    std::ostringstream oss;
    oss << std::put_time(&tm, "%Y-%m-%d");
    return oss.str();
}

nlohmann::json CerveauPrincipal::genererRapportQuotidien() {
    nlohmann::json rapport;

    CerveauConfig configBrain(configPath);
    if (!configBrain.loadConfig()) {
        rapport["error"] = "Impossible de charger la configuration (CerveauConfig).";
        return rapport;
    }

    CerveauCours coursBrain(coursPath);
    if (!coursBrain.loadConfig()) {
        rapport["error"] = "Impossible de charger les cours (CerveauCours).";
        return rapport;
    }

    const AppConfig& cfg = configBrain.getConfig();
    const CoursConfig& crs = coursBrain.getConfig();

    // 1. Calcul du temps libre
    int heuresTravailJour = std::max(1, cfg.maxStudyHoursPerDay); // eviter zero
    int tempsLibreMin = heuresTravailJour * 60; // Temps moyen par jour
    rapport["tempsDispoMin"] = tempsLibreMin;

    std::vector<nlohmann::json> tachesJson;
    int tempsRequisMin = 0;
    std::string todayStr = getTodayString();

    // 2. Scan des cours pour générer la To-Do List du jour
    for (const auto& s : crs.semestres) {
        for (const auto& ue : s.ues) {
            for (const auto& m : ue.matieres) {
                
                // Logique CM
                for (const auto& cm : m.listeCM) {
                    bool doitReviser = false;
                    if (cm.derniereRevision.empty()) doitReviser = true;
                    else if (cm.derniereRevision != todayStr) {
                        doitReviser = true; // Pour l'instant on force la révision (simplification v0.1)
                    }

                    if (doitReviser) {
                        nlohmann::json t;
                        t["matiere"] = m.nom;
                        t["type"] = "CM";
                        t["titre"] = cm.titre;
                        t["dureeMinutes"] = (cm.jActuel == 0) ? 120 : 30; // 2h si découverte, 30min sinon
                        tachesJson.push_back(t);
                        tempsRequisMin += t["dureeMinutes"].get<int>();
                    }
                }

                // Logique Exercices (TD)
                std::vector<Exercice> tds;
                for (const auto& ex : m.listeTD) {
                    if (ex.dernierePratique != todayStr) {
                        tds.push_back(ex);
                    }
                }
                std::sort(tds.begin(), tds.end(), [](const Exercice& a, const Exercice& b) {
                    if (a.nombrePratiques != b.nombrePratiques) return a.nombrePratiques < b.nombrePratiques;
                    return a.dernierePratique < b.dernierePratique;
                });
                
                int count = 0;
                for (const auto& ex : tds) {
                    if (count >= 2) break;
                    nlohmann::json t;
                    t["matiere"] = m.nom;
                    t["type"] = "TD";
                    t["titre"] = ex.titre;
                    t["dureeMinutes"] = 20; // 20 min par TD
                    t["pdfSource"] = ex.pdfSource;
                    t["page"] = ex.page;
                    tachesJson.push_back(t);
                    tempsRequisMin += 20;
                    count++;
                }

                // Logique TP
                std::vector<Exercice> tps;
                for (const auto& ex : m.listeTP) {
                    if (ex.dernierePratique != todayStr) {
                        tps.push_back(ex);
                    }
                }
                std::sort(tps.begin(), tps.end(), [](const Exercice& a, const Exercice& b) {
                    if (a.nombrePratiques != b.nombrePratiques) return a.nombrePratiques < b.nombrePratiques;
                    return a.dernierePratique < b.dernierePratique;
                });
                
                if (!tps.empty()) {
                    const auto& ex = tps[0]; // On ne prend que le 1er (1 TP max)
                    nlohmann::json t;
                    t["matiere"] = m.nom;
                    t["type"] = "TP";
                    t["titre"] = ex.titre;
                    t["dureeMinutes"] = 30; // 30 min par TP
                    t["pdfSource"] = ex.pdfSource;
                    t["page"] = ex.page;
                    tachesJson.push_back(t);
                    tempsRequisMin += 30;
                }
            }
        }
    }

    rapport["tempsRequisMin"] = tempsRequisMin;
    rapport["tachesDuJour"] = tachesJson;
    rapport["statut"] = (tempsRequisMin > tempsLibreMin) ? "SURCHARGE" : "OK";

    return rapport;
}
