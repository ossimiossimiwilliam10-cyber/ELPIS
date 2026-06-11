#include "CerveauConfig.h"
#include <fstream>
#include <iostream>
#include <string>
#include <algorithm> // Pour std::max et std::min
#include <filesystem>
#include "../../../lib/json.hpp" // Rétabli pour satisfaire l'analyse de dépendance statique

using json = nlohmann::json;

CerveauConfig::CerveauConfig(const std::string& path) : configFilePath(path) {
    // Les valeurs par défaut sont désormais gérées directement dans AppConfig (CerveauConfig.h)
}

void CerveauConfig::sanitize(AppConfig& c) {
    c.maxStudyHoursPerDay = std::max(0, std::min(24, c.maxStudyHoursPerDay));
    c.targetGrade = std::max(0.0f, std::min(20.0f, c.targetGrade));
    c.summerStudyHoursCompleted = std::max(0, c.summerStudyHoursCompleted);
    c.maxSubjectsPerDay = std::max(1, c.maxSubjectsPerDay);
    c.studyBlockDurationMinutes = std::max(10, std::min(240, c.studyBlockDurationMinutes));
    c.activeRecallMinutesPerDay = std::max(0, c.activeRecallMinutesPerDay);
    if (c.theme != "light" && c.theme != "dark") {
        c.theme = "dark";
    }
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
        
        AppConfig tempConfig; // Initialisé avec les valeurs par défaut du .h
        
        // On utilise les valeurs par défaut de tempConfig si la clé est absente du JSON
        tempConfig.studyStartDate = j.value("studyStartDate", tempConfig.studyStartDate);
        tempConfig.bedtime = j.value("bedtime", tempConfig.bedtime);
        tempConfig.wakeUpTime = j.value("wakeUpTime", tempConfig.wakeUpTime);
        tempConfig.maxStudyHoursPerDay = j.value("maxStudyHoursPerDay", tempConfig.maxStudyHoursPerDay);
        tempConfig.targetGrade = j.value("targetGrade", tempConfig.targetGrade);
        tempConfig.summerStudyHoursCompleted = j.value("summerStudyHoursCompleted", tempConfig.summerStudyHoursCompleted);
        tempConfig.maxSubjectsPerDay = j.value("maxSubjectsPerDay", tempConfig.maxSubjectsPerDay);
        tempConfig.studyBlockDurationMinutes = j.value("studyBlockDurationMinutes", tempConfig.studyBlockDurationMinutes);
        tempConfig.activeRecallMinutesPerDay = j.value("activeRecallMinutesPerDay", tempConfig.activeRecallMinutesPerDay);
        tempConfig.theme = j.value("theme", tempConfig.theme);
        
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
        
        // On nettoie les valeurs lues et on valide
        sanitize(tempConfig);
        currentConfig = std::move(tempConfig);
        
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

    std::string tempFilePath = configFilePath + ".tmp";
    std::ofstream file(tempFilePath);
    if (!file.is_open()) {
        std::cerr << "Impossible de creer le fichier temporaire : " << tempFilePath << std::endl;
        return false;
    }

    file << j.dump(4);
    
    if (!file.good()) {
        std::cerr << "Erreur d'ecriture sur le disque (disque plein ?)" << std::endl;
        file.close();
        std::filesystem::remove(tempFilePath);
        return false;
    }
    file.close();

    // Renommage atomique avec std::filesystem::rename
    std::error_code ec;
    std::filesystem::rename(tempFilePath, configFilePath, ec);
    if (ec) {
        // En cas d'erreur de renommage sur certains vieux OS Windows, on essaie une méthode plus bas niveau, ou on signale.
        std::cerr << "Erreur lors du renommage atomique : " << ec.message() << std::endl;
        // Optionnellement, on pourrait essayer un remove+rename en fallback, mais DeepSeek interdit std::remove.
        return false;
    }

    return true;
}

const AppConfig& CerveauConfig::getConfig() const {
    return currentConfig;
}

void CerveauConfig::setConfig(AppConfig newConfig) {
    sanitize(newConfig);
    currentConfig = std::move(newConfig);
}
