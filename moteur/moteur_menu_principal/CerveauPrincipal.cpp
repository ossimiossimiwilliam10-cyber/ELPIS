#include "CerveauPrincipal.h"
#include <fstream>
#include <iostream>
#include <algorithm>
#include <chrono>
#include <ctime>
#include <iomanip>
#include <sstream>

CerveauPrincipal::CerveauPrincipal(const std::string& configPath, const std::string& coursPath) 
    : configPath(configPath), coursPath(coursPath) {}

std::string CerveauPrincipal::getTodayString() {
    auto t = std::time(nullptr);
    auto tm = *std::localtime(&t);
    std::ostringstream oss;
    oss << std::put_time(&tm, "%Y-%m-%d");
    return oss.str();
}

bool CerveauPrincipal::loadData() {
    std::ifstream fConfig(configPath);
    if (fConfig.is_open()) {
        fConfig >> configJson;
    } else {
        return false;
    }

    std::ifstream fCours(coursPath);
    if (fCours.is_open()) {
        fCours >> coursJson;
    } else {
        return false;
    }

    return true;
}

nlohmann::json CerveauPrincipal::genererRapportQuotidien() {
    nlohmann::json rapport;
    if (!loadData()) {
        rapport["error"] = "Impossible de charger les configurations.";
        return rapport;
    }

    // 1. Calcul du temps libre
    int heuresTravailSemaine = 20; // Default
    if (configJson.contains("objectif") && configJson["objectif"].contains("heuresTravailPersonnel")) {
        heuresTravailSemaine = configJson["objectif"]["heuresTravailPersonnel"];
    }
    int tempsLibreMin = (heuresTravailSemaine * 60) / 7; // Temps moyen par jour
    rapport["tempsDispoMin"] = tempsLibreMin;

    std::vector<nlohmann::json> tachesJson;
    int tempsRequisMin = 0;
    std::string todayStr = getTodayString();

    // 2. Scan des cours pour générer la To-Do List du jour
    if (coursJson.contains("semestres")) {
        for (const auto& s : coursJson["semestres"]) {
            if (s.contains("ues")) {
                for (const auto& ue : s["ues"]) {
                    if (ue.contains("matieres")) {
                        for (const auto& m : ue["matieres"]) {
                            std::string nomMatiere = m.value("nom", "Inconnue");

                            // Logique CM
                            if (m.contains("listeCM")) {
                                for (const auto& cm : m["listeCM"]) {
                                    int jActuel = cm.value("jActuel", 0);
                                    std::string derniereRev = cm.value("derniereRevision", "");
                                    
                                    // Simplification : si J0 et non fait, on le propose. 
                                    // Ou si c'est censé être révisé aujourd'hui (basé sur la date).
                                    // Pour l'instant on propose tous les CM qui n'ont pas été révisés aujourd'hui 
                                    // et qui ont besoin d'être revus (par exemple ceux sans date ou J0).
                                    bool doitReviser = false;
                                    if (derniereRev.empty()) doitReviser = true;
                                    else if (derniereRev != todayStr) {
                                        // TODO: Calculer la différence de jours exacte
                                        // Pour l'instant on force la révision si ce n'est pas fait aujourd'hui
                                        doitReviser = true;
                                    }

                                    if (doitReviser) {
                                        nlohmann::json t;
                                        t["matiere"] = nomMatiere;
                                        t["type"] = "CM";
                                        t["titre"] = cm.value("titre", "CM");
                                        t["dureeMinutes"] = (jActuel == 0) ? 120 : 30; // 2h si découverte, 30min sinon
                                        tachesJson.push_back(t);
                                        tempsRequisMin += t["dureeMinutes"].get<int>();
                                    }
                                }
                            }

                            // Logique Exercices (TD)
                            if (m.contains("listeTD")) {
                                std::vector<nlohmann::json> tds;
                                for (const auto& ex : m["listeTD"]) {
                                    if (ex.value("dernierePratique", "") != todayStr) {
                                        tds.push_back(ex);
                                    }
                                }
                                std::sort(tds.begin(), tds.end(), [](const nlohmann::json& a, const nlohmann::json& b) {
                                    int nA = a.value("nombrePratiques", 0);
                                    int nB = b.value("nombrePratiques", 0);
                                    if (nA != nB) return nA < nB;
                                    return a.value("dernierePratique", "") < b.value("dernierePratique", "");
                                });
                                int count = 0;
                                for (const auto& ex : tds) {
                                    if (count >= 2) break;
                                    nlohmann::json t;
                                    t["matiere"] = nomMatiere;
                                    t["type"] = "TD";
                                    t["titre"] = ex.value("titre", "Exo");
                                    t["dureeMinutes"] = 20; // 20 min par TD
                                    t["pdfSource"] = ex.value("pdfSource", "");
                                    t["page"] = ex.value("page", 1);
                                    tachesJson.push_back(t);
                                    tempsRequisMin += 20;
                                    count++;
                                }
                            }

                            // Logique TP
                            if (m.contains("listeTP")) {
                                std::vector<nlohmann::json> tps;
                                for (const auto& ex : m["listeTP"]) {
                                    if (ex.value("dernierePratique", "") != todayStr) {
                                        tps.push_back(ex);
                                    }
                                }
                                std::sort(tps.begin(), tps.end(), [](const nlohmann::json& a, const nlohmann::json& b) {
                                    int nA = a.value("nombrePratiques", 0);
                                    int nB = b.value("nombrePratiques", 0);
                                    if (nA != nB) return nA < nB;
                                    return a.value("dernierePratique", "") < b.value("dernierePratique", "");
                                });
                                if (!tps.empty()) {
                                    nlohmann::json t;
                                    t["matiere"] = nomMatiere;
                                    t["type"] = "TP";
                                    t["titre"] = tps[0].value("titre", "TP");
                                    t["dureeMinutes"] = 30; // 30 min par TP
                                    t["pdfSource"] = tps[0].value("pdfSource", "");
                                    t["page"] = tps[0].value("page", 1);
                                    tachesJson.push_back(t);
                                    tempsRequisMin += 30;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    rapport["tempsRequisMin"] = tempsRequisMin;
    rapport["tachesDuJour"] = tachesJson;
    rapport["statut"] = (tempsRequisMin > tempsLibreMin) ? "SURCHARGE" : "OK";

    return rapport;
}
