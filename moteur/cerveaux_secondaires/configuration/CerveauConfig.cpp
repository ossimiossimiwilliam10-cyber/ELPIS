#include "CerveauConfig.h"
#include <fstream>
#include <iostream>
#include <string>
#include <algorithm> // Pour std::max et std::min
#include <cstdio>    // Pour std::remove et std::rename
#include "json.hpp"

using json = nlohmann::json;

CerveauConfig::CerveauConfig(const std::string& path) : configFilePath(path) {
    // Les valeurs par défaut sont désormais gérées directement dans AppConfig (CerveauConfig.h)
    // Cela évite la duplication dénoncée par l'audit.
}

bool CerveauConfig::loadConfig() {
    std::ifstream file(configFilePath);
    if (!file.is_open()) {
        std::cerr << "Fichier introuvable. Il sera cree lors de la prochaine sauvegarde." << std::endl;
        return false;
    }

    json j;
    try {
        file >> j;
        
        // Parsing sécurisé dans une structure temporaire pour éviter la corruption d'état
        AppConfig tempConfig;
        
        tempConfig.studyStartDate = j.value("studyStartDate", "07-09-2026");
        tempConfig.bedtime = j.value("bedtime", "23:00");
        tempConfig.wakeUpTime = j.value("wakeUpTime", "07:00");
        
        // Validation basique des entiers et flottants (Garbage in, garbage out)
        tempConfig.maxStudyHoursPerDay = std::max(0, std::min(24, j.value("maxStudyHoursPerDay", 8)));
        tempConfig.targetGrade = std::max(0.0f, std::min(20.0f, j.value("targetGrade", 14.0f)));
        tempConfig.summerStudyHoursCompleted = std::max(0, j.value("summerStudyHoursCompleted", 0));
        tempConfig.maxSubjectsPerDay = std::max(1, j.value("maxSubjectsPerDay", 3));
        tempConfig.studyBlockDurationMinutes = std::max(10, std::min(240, j.value("studyBlockDurationMinutes", 50)));
        tempConfig.activeRecallMinutesPerDay = std::max(0, j.value("activeRecallMinutesPerDay", 60));
        
        // Validation basique du thème
        std::string parsedTheme = j.value("theme", "dark");
        if (parsedTheme == "dark" || parsedTheme == "light") {
            tempConfig.theme = parsedTheme;
        } else {
            tempConfig.theme = "dark"; // Fallback de sécurité
        }
        
        // Charger les matières
        if (j.contains("subjects")) {
            for (const auto& item : j["subjects"]) {
                Subject s;
                s.name = item.value("name", "");
                s.color = item.value("color", "");
                if (item.contains("examDates")) {
                    for (const auto& date : item["examDates"]) {
                        s.examDates.push_back(date);
                    }
                }
                tempConfig.subjects.push_back(s);
            }
        }

        // Charger les engagements fixes
        if (j.contains("fixedCommitments")) {
            for (const auto& item : j["fixedCommitments"]) {
                FixedCommitment fc;
                fc.title = item.value("title", "");
                fc.dayOfWeek = item.value("dayOfWeek", "");
                fc.startTime = item.value("startTime", "");
                fc.endTime = item.value("endTime", "");
                tempConfig.fixedCommitments.push_back(fc);
            }
        }
        
        // Tout s'est bien passé, on remplace la configuration actuelle de façon sûre
        currentConfig = tempConfig;
        
    } catch (const std::exception& e) {
        std::cerr << "Erreur lors de la lecture du JSON (fichier corrompu ou mal formatté) : " << e.what() << std::endl;
        return false;
    }

    return true;
}

bool CerveauConfig::saveConfig() {
    json j;
    j["studyStartDate"] = currentConfig.studyStartDate;
    j["bedtime"] = currentConfig.bedtime;
    j["wakeUpTime"] = currentConfig.wakeUpTime;
    j["maxStudyHoursPerDay"] = currentConfig.maxStudyHoursPerDay;
    j["targetGrade"] = currentConfig.targetGrade;
    j["summerStudyHoursCompleted"] = currentConfig.summerStudyHoursCompleted;
    j["maxSubjectsPerDay"] = currentConfig.maxSubjectsPerDay;
    j["studyBlockDurationMinutes"] = currentConfig.studyBlockDurationMinutes;
    j["activeRecallMinutesPerDay"] = currentConfig.activeRecallMinutesPerDay;
    j["theme"] = currentConfig.theme;

    json subjectsJson = json::array();
    for (const auto& s : currentConfig.subjects) {
        json subj;
        subj["name"] = s.name;
        subj["color"] = s.color;
        json dates = json::array();
        for (const auto& d : s.examDates) {
            dates.push_back(d);
        }
        subj["examDates"] = dates;
        subjectsJson.push_back(subj);
    }
    j["subjects"] = subjectsJson;

    json commitmentsJson = json::array();
    for (const auto& fc : currentConfig.fixedCommitments) {
        json commit;
        commit["title"] = fc.title;
        commit["dayOfWeek"] = fc.dayOfWeek;
        commit["startTime"] = fc.startTime;
        commit["endTime"] = fc.endTime;
        commitmentsJson.push_back(commit);
    }
    j["fixedCommitments"] = commitmentsJson;

    // Écriture atomique avec fichier temporaire
    std::string tempFilePath = configFilePath + ".tmp";
    std::ofstream file(tempFilePath);
    if (!file.is_open()) {
        std::cerr << "Impossible de creer le fichier temporaire : " << tempFilePath << std::endl;
        return false;
    }

    file << j.dump(4);
    
    // Vérification que l'écriture a réussi (disque non plein)
    if (!file.good()) {
        std::cerr << "Erreur d'ecriture sur le disque (disque plein ?)" << std::endl;
        file.close();
        std::remove(tempFilePath.c_str());
        return false;
    }
    file.close();

    // Renommage atomique
    std::remove(configFilePath.c_str()); // Nécessaire sur Windows si le fichier cible existe déjà
    if (std::rename(tempFilePath.c_str(), configFilePath.c_str()) != 0) {
        std::cerr << "Erreur lors du renommage du fichier temporaire vers : " << configFilePath << std::endl;
        return false;
    }

    return true;
}

const AppConfig& CerveauConfig::getConfig() const {
    return currentConfig;
}

void CerveauConfig::setConfig(const AppConfig& newConfig) {
    currentConfig = newConfig;
    // On valide aussi la modification en mémoire
    currentConfig.maxStudyHoursPerDay = std::max(0, std::min(24, currentConfig.maxStudyHoursPerDay));
    currentConfig.targetGrade = std::max(0.0f, std::min(20.0f, currentConfig.targetGrade));
    currentConfig.summerStudyHoursCompleted = std::max(0, currentConfig.summerStudyHoursCompleted);
    currentConfig.maxSubjectsPerDay = std::max(1, currentConfig.maxSubjectsPerDay);
    currentConfig.studyBlockDurationMinutes = std::max(10, std::min(240, currentConfig.studyBlockDurationMinutes));
    currentConfig.activeRecallMinutesPerDay = std::max(0, currentConfig.activeRecallMinutesPerDay);
    if (currentConfig.theme != "light" && currentConfig.theme != "dark") {
        currentConfig.theme = "dark";
    }
}
