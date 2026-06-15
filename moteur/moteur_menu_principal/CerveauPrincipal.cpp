#include "CerveauPrincipal.h"
#include "../../lib/json.hpp"
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

std::string CerveauPrincipal::getDayOfWeekString() const {
    auto t = std::time(nullptr);
    auto tm = *std::localtime(&t);
    const char* days[] = {"Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"};
    return days[tm.tm_wday];
}

std::string CerveauPrincipal::genererRapportQuotidien() {
    nlohmann::json rapport;

    CerveauConfig configBrain(configPath);
    if (!configBrain.loadConfig()) {
        rapport["error"] = "Impossible de charger la configuration (CerveauConfig).";
        return rapport.dump();
    }

    CerveauCours coursBrain(coursPath);
    if (!coursBrain.loadConfig()) {
        rapport["error"] = "Impossible de charger les cours (CerveauCours).";
        return rapport.dump();
    }

    const AppConfig& cfg = configBrain.getConfig();
    const CoursConfig& crs = coursBrain.getConfig();

    // 1. Calcul du temps libre de base
    int heuresTravailJour = std::max(1, cfg.maxStudyHoursPerDay);
    int tempsLibreMin = heuresTravailJour * 60;

    // Soustraction des Fixed Commitments du jour
    std::string todayDayOfWeek = getDayOfWeekString();
    for (const auto& fc : cfg.fixedCommitments) {
        if (fc.dayOfWeek == todayDayOfWeek || fc.dayOfWeek == "Tous les jours") {
            int startH = 0, startM = 0, endH = 0, endM = 0;
            if (fc.startTime.length() >= 5 && fc.endTime.length() >= 5) {
                try {
                    startH = std::stoi(fc.startTime.substr(0, 2));
                    startM = std::stoi(fc.startTime.substr(3, 2));
                    endH = std::stoi(fc.endTime.substr(0, 2));
                    endM = std::stoi(fc.endTime.substr(3, 2));
                    int duration = (endH * 60 + endM) - (startH * 60 + startM);
                    if (duration > 0) {
                        tempsLibreMin -= duration;
                    }
                } catch (...) {
                    // Ignore format invalide
                }
            }
        }
    }
    if (tempsLibreMin < 0) tempsLibreMin = 0;

    rapport["tempsDispoMin"] = tempsLibreMin;

    std::vector<nlohmann::json> tachesJson;
    int tempsRequisMin = 0;
    std::string todayStr = getTodayString();

    auto tNowForParity = std::time(nullptr);
    auto tmNowForParity = *std::localtime(&tNowForParity);
    int parityJour = tmNowForParity.tm_yday % 2;

    // 2. Scan des cours pour générer la To-Do List du jour
    for (const auto& l : crs.licences) {
        for (const auto& s : l.semestres) {
            int matiereIndexDansSemestre = 0;
            for (const auto& ue : s.ues) {
                for (const auto& m : ue.matieres) {
                
                // --- Logique Cours Magistraux (CM) ---
                for (const auto& cm : m.listeCM) {
                    bool doitReviser = false;
                    if (cm.derniereRevision.empty()) {
                        doitReviser = true;
                    } else {
                        // Implémentation réelle de la méthode des J
                        std::tm tmRev = {};
                        std::istringstream ss(cm.derniereRevision);
                        ss >> std::get_time(&tmRev, "%Y-%m-%d");
                        
                        if (!ss.fail()) {
                            // Normalisation à minuit pour comparer en jours pleins
                            tmRev.tm_hour = 0; tmRev.tm_min = 0; tmRev.tm_sec = 0;
                            std::time_t tRev = std::mktime(&tmRev);
                            
                            std::time_t tNow = std::time(nullptr);
                            std::tm* tmNow = std::localtime(&tNow);
                            tmNow->tm_hour = 0; tmNow->tm_min = 0; tmNow->tm_sec = 0;
                            tNow = std::mktime(tmNow);
                            
                            double seconds = std::difftime(tNow, tRev);
                            int joursEcoules = static_cast<int>(seconds / (60 * 60 * 24));
                            
                            if (joursEcoules >= cm.jActuel && cm.jActuel > 0) {
                                doitReviser = true;
                            } else if (cm.jActuel == 0 && joursEcoules >= 0) {
                                // J0 doit être revu s'il n'a pas été revu aujourd'hui
                                // Si joursEcoules == 0 (même jour), ne pas reproposer
                                doitReviser = (joursEcoules > 0);
                            }
                        } else {
                            doitReviser = true; // Date corrompue
                        }
                    }

                    if (doitReviser) {
                        nlohmann::json t;
                        t["matiere"] = m.nom;
                        t["type"] = "CM";
                        t["titre"] = cm.titre;
                        t["dureeMinutes"] = (cm.jActuel == 0) ? 120 : 30;
                        tachesJson.push_back(t);
                        tempsRequisMin += t["dureeMinutes"].get<int>();
                    }
                }

                bool activePourExercices = ((matiereIndexDansSemestre % 2) == parityJour);
                matiereIndexDansSemestre++;

                if (!activePourExercices) {
                    continue;
                }

                // --- Logique Exercices (TD) ---
                std::vector<Exercice> tds;
                int doneTDToday = 0;
                for (const auto& ex : m.listeTD) {
                    if (ex.dernierePratique == todayStr) {
                        doneTDToday++;
                    } else {
                        tds.push_back(ex);
                    }
                }
                std::sort(tds.begin(), tds.end(), [](const Exercice& a, const Exercice& b) {
                    // Score de priorité combiné : pratiques + ancienneté + difficulté
                    auto getPrio = [](const Exercice& ex) -> double {
                        double base = 1.0 / (ex.nombrePratiques + 1.0); // Moins pratiqué = plus urgent
                        if (ex.difficulte == "difficile") base *= 2.0;
                        else if (ex.difficulte == "assez_difficile") base *= 1.5;
                        else if (ex.difficulte == "facile") base *= 0.7;
                        else if (ex.difficulte == "tres_facile") base *= 0.5;
                        // "moyen" ou "" (pas noté) : neutre (= 1.0)
                        return base;
                    };
                    double pa = getPrio(a);
                    double pb = getPrio(b);
                    if (std::abs(pa - pb) > 0.0001) return pa > pb; // Priorité décroissante
                    return a.dernierePratique < b.dernierePratique; // Plus ancien d'abord
                });
                
                int tdLimit = std::max(0, 2 - doneTDToday);
                int tdCount = 0;
                for (const auto& ex : tds) {
                    if (tdCount >= tdLimit) break;
                    nlohmann::json t;
                    t["matiere"] = m.nom;
                    t["type"] = "TD";
                    t["titre"] = ex.titre;
                    t["dureeMinutes"] = 20;
                    t["pdfSource"] = ex.pdfSource;
                    t["page"] = ex.page;
                    t["difficulte"] = ex.difficulte;
                    tachesJson.push_back(t);
                    tempsRequisMin += 20;
                    tdCount++;
                }

                // --- Logique TP ---
                std::vector<Exercice> tps;
                int doneTPToday = 0;
                for (const auto& ex : m.listeTP) {
                    if (ex.dernierePratique == todayStr) {
                        doneTPToday++;
                    } else {
                        tps.push_back(ex);
                    }
                }
                std::sort(tps.begin(), tps.end(), [](const Exercice& a, const Exercice& b) {
                    auto getPrio = [](const Exercice& ex) -> double {
                        double base = 1.0 / (ex.nombrePratiques + 1.0);
                        if (ex.difficulte == "difficile") base *= 2.0;
                        else if (ex.difficulte == "assez_difficile") base *= 1.5;
                        else if (ex.difficulte == "facile") base *= 0.7;
                        else if (ex.difficulte == "tres_facile") base *= 0.5;
                        return base;
                    };
                    double pa = getPrio(a);
                    double pb = getPrio(b);
                    if (std::abs(pa - pb) > 0.0001) return pa > pb;
                    return a.dernierePratique < b.dernierePratique;
                });
                
                int tpLimit = std::max(0, 1 - doneTPToday);
                int tpCount = 0;
                for (const auto& ex : tps) {
                    if (tpCount >= tpLimit) break;
                    nlohmann::json t;
                    t["matiere"] = m.nom;
                    t["type"] = "TP";
                    t["titre"] = ex.titre;
                    t["dureeMinutes"] = 30;
                    t["pdfSource"] = ex.pdfSource;
                    t["page"] = ex.page;
                    t["difficulte"] = ex.difficulte;
                    tachesJson.push_back(t);
                    tempsRequisMin += 30;
                    tpCount++;
                }
            }
        }
    }
    }

    rapport["tempsRequisMin"] = tempsRequisMin;
    rapport["tachesDuJour"] = tachesJson;
    rapport["statut"] = (tempsRequisMin > tempsLibreMin) ? "SURCHARGE" : "OK";

    return rapport.dump();
}
