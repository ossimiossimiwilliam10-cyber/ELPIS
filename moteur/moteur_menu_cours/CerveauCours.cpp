#include "CerveauCours.h"
#include <fstream>
#include <iostream>
#include <algorithm>
#include <cstdio>
#include "../../lib/json.hpp"

static Exercice parseExercice(const nlohmann::json& itemEx) {
    Exercice ex;
    ex.titre = itemEx.value("titre", "");
    ex.page = itemEx.value("page", 1);
    ex.pdfSource = itemEx.value("pdfSource", "");
    ex.dernierePratique = itemEx.value("dernierePratique", "");
    ex.nombrePratiques = itemEx.value("nombrePratiques", 0);
    return ex;
}

static nlohmann::json serializeExercice(const Exercice& ex) {
    nlohmann::json exJson;
    exJson["titre"] = ex.titre;
    exJson["page"] = ex.page;
    exJson["pdfSource"] = ex.pdfSource;
    exJson["dernierePratique"] = ex.dernierePratique;
    exJson["nombrePratiques"] = ex.nombrePratiques;
    return exJson;
}

CerveauCours::CerveauCours(const std::string& path) : configFilePath(path) {}

void CerveauCours::sanitize(CoursConfig& c) {
    for (auto& s : c.semestres) {
        for (auto& ue : s.ues) {
            ue.ects = std::max(0, std::min(180, ue.ects));
            for (auto& m : ue.matieres) {
                m.cm_h = std::max(0, std::min(500, m.cm_h));
                m.td_h = std::max(0, std::min(500, m.td_h));
                m.tp_h = std::max(0, std::min(500, m.tp_h));
                for (auto& cm : m.listeCM) {
                    cm.jActuel = std::max(0, std::min(3000, cm.jActuel));
                }
                for (auto& ex : m.listeTD) {
                    ex.page = std::max(1, std::min(9999, ex.page));
                    ex.nombrePratiques = std::max(0, std::min(10000, ex.nombrePratiques));
                }
                for (auto& ex : m.listeTP) {
                    ex.page = std::max(1, std::min(9999, ex.page));
                    ex.nombrePratiques = std::max(0, std::min(10000, ex.nombrePratiques));
                }
            }
        }
    }
}

bool CerveauCours::loadConfig() {
    std::ifstream file(configFilePath);
    if (!file.is_open()) {
        std::cerr << "Fichier introuvable. Il sera cree lors de la prochaine sauvegarde." << std::endl;
        return false;
    }

    nlohmann::json j;
    try {
        file >> j;
        CoursConfig tempConfig;

        if (j.contains("semestres")) {
            for (const auto& itemS : j["semestres"]) {
                Semestre s;
                s.nom = itemS.value("nom", "");
                
                if (itemS.contains("ues")) {
                    for (const auto& itemUE : itemS["ues"]) {
                        UE ue;
                        ue.nom = itemUE.value("nom", "");
                        ue.ects = itemUE.value("ects", 0);
                        
                        if (itemUE.contains("matieres")) {
                            for (const auto& itemM : itemUE["matieres"]) {
                                Matiere m;
                                m.nom = itemM.value("nom", "");
                                m.cm_h = itemM.value("cm_h", 0);
                                m.td_h = itemM.value("td_h", 0);
                                m.tp_h = itemM.value("tp_h", 0);
                                
                                if (itemM.contains("listeCM")) {
                                    for (const auto& itemCM : itemM["listeCM"]) {
                                        CoursMagistral cm;
                                        cm.titre = itemCM.value("titre", "");
                                        cm.jActuel = itemCM.value("jActuel", 0);
                                        cm.derniereRevision = itemCM.value("derniereRevision", "");
                                        cm.fichePdfPath = itemCM.value("fichePdfPath", "");
                                        m.listeCM.push_back(cm);
                                    }
                                }
                                
                                if (itemM.contains("listeTD")) {
                                    for (const auto& itemEx : itemM["listeTD"]) {
                                        m.listeTD.push_back(parseExercice(itemEx));
                                    }
                                }
                                
                                if (itemM.contains("listeTP")) {
                                    for (const auto& itemEx : itemM["listeTP"]) {
                                        m.listeTP.push_back(parseExercice(itemEx));
                                    }
                                }
                                ue.matieres.push_back(m);
                            }
                        }
                        s.ues.push_back(ue);
                    }
                }
                tempConfig.semestres.push_back(s);
            }
        }
        
        sanitize(tempConfig);
        currentConfig = std::move(tempConfig);
        
    } catch (const std::exception& e) {
        std::cerr << "Erreur de parsing : " << e.what() << std::endl;
        return false;
    }

    return true;
}

bool CerveauCours::saveConfig() {
    nlohmann::json j;
    
    nlohmann::json semestresJson = nlohmann::json::array();
    for (const auto& s : currentConfig.semestres) {
        nlohmann::json sJson;
        sJson["nom"] = s.nom;
        
        nlohmann::json uesJson = nlohmann::json::array();
        for (const auto& ue : s.ues) {
            nlohmann::json ueJson;
            ueJson["nom"] = ue.nom;
            ueJson["ects"] = ue.ects;
            
            nlohmann::json matieresJson = nlohmann::json::array();
            for (const auto& m : ue.matieres) {
                nlohmann::json mJson;
                mJson["nom"] = m.nom;
                mJson["cm_h"] = m.cm_h;
                mJson["td_h"] = m.td_h;
                mJson["tp_h"] = m.tp_h;
                
                nlohmann::json listeCMJson = nlohmann::json::array();
                for (const auto& cm : m.listeCM) {
                    nlohmann::json cmJson;
                    cmJson["titre"] = cm.titre;
                    cmJson["jActuel"] = cm.jActuel;
                    cmJson["derniereRevision"] = cm.derniereRevision;
                    cmJson["fichePdfPath"] = cm.fichePdfPath;
                    listeCMJson.push_back(cmJson);
                }
                mJson["listeCM"] = listeCMJson;

                nlohmann::json listeTDJson = nlohmann::json::array();
                for (const auto& ex : m.listeTD) {
                    listeTDJson.push_back(serializeExercice(ex));
                }
                mJson["listeTD"] = listeTDJson;

                nlohmann::json listeTPJson = nlohmann::json::array();
                for (const auto& ex : m.listeTP) {
                    listeTPJson.push_back(serializeExercice(ex));
                }
                mJson["listeTP"] = listeTPJson;

                matieresJson.push_back(mJson);
            }
            ueJson["matieres"] = matieresJson;
            uesJson.push_back(ueJson);
        }
        sJson["ues"] = uesJson;
        semestresJson.push_back(sJson);
    }
    j["semestres"] = semestresJson;

    std::string tempFilePath = configFilePath + ".tmp";
    std::ofstream file(tempFilePath);
    if (!file.is_open()) {
        std::cerr << "Erreur: Impossible d'ouvrir le fichier temporaire " << tempFilePath << std::endl;
        return false;
    }
    file << j.dump(4);
    if (!file.good()) {
        std::cerr << "Erreur d'ecriture sur le disque (disque plein ?)" << std::endl;
        file.close();
        std::remove(tempFilePath.c_str());
        return false;
    }
    file.close();

    // Renommage atomique avec remove manuel avant pour Windows UCRT
    std::remove(configFilePath.c_str());
    if (std::rename(tempFilePath.c_str(), configFilePath.c_str()) != 0) {
        std::cerr << "Erreur lors du renommage atomique vers " << configFilePath << std::endl;
        return false;
    }

    return true;
}

const CoursConfig& CerveauCours::getConfig() const { return currentConfig; }

void CerveauCours::setConfig(CoursConfig newConfig) {
    sanitize(newConfig);
    currentConfig = std::move(newConfig);
}
