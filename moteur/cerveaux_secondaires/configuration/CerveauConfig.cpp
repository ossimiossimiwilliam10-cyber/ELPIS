#include "CerveauConfig.h"
#include <fstream>
#include <iostream>
#include "json.hpp" // La librairie JSON que nous venons de télécharger

using json = nlohmann::json;

CerveauConfig::CerveauConfig(const std::string& path) : configFilePath(path) {
    // Initialisation avec des valeurs par défaut au cas où le fichier n'existe pas encore
    currentConfig.studyStartDate = "07-09-2026";
    currentConfig.bedtime = "23:00";
    currentConfig.wakeUpTime = "07:00";
    currentConfig.maxStudyHoursPerDay = 8;
    currentConfig.targetGrade = 14.0f;
    currentConfig.summerStudyHoursCompleted = 0;
    currentConfig.maxSubjectsPerDay = 3;
    currentConfig.studyBlockDurationMinutes = 50;
    currentConfig.activeRecallMinutesPerDay = 60;
    currentConfig.theme = "dark";
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
        currentConfig.studyStartDate = j.value("studyStartDate", "07-09-2026");
        currentConfig.bedtime = j.value("bedtime", "23:00");
        currentConfig.wakeUpTime = j.value("wakeUpTime", "07:00");
        currentConfig.maxStudyHoursPerDay = j.value("maxStudyHoursPerDay", 8);
        currentConfig.targetGrade = j.value("targetGrade", 14.0f);
        currentConfig.summerStudyHoursCompleted = j.value("summerStudyHoursCompleted", 0);
        currentConfig.maxSubjectsPerDay = j.value("maxSubjectsPerDay", 3);
        currentConfig.studyBlockDurationMinutes = j.value("studyBlockDurationMinutes", 50);
        currentConfig.activeRecallMinutesPerDay = j.value("activeRecallMinutesPerDay", 60);
        currentConfig.theme = j.value("theme", "dark");
        
        // Charger les matières
        if (j.contains("subjects")) {
            currentConfig.subjects.clear();
            for (const auto& item : j["subjects"]) {
                Subject s;
                s.name = item.value("name", "");
                s.color = item.value("color", "");
                if (item.contains("examDates")) {
                    for (const auto& date : item["examDates"]) {
                        s.examDates.push_back(date);
                    }
                }
                currentConfig.subjects.push_back(s);
            }
        }

        // Charger les engagements fixes
        if (j.contains("fixedCommitments")) {
            currentConfig.fixedCommitments.clear();
            for (const auto& item : j["fixedCommitments"]) {
                FixedCommitment fc;
                fc.title = item.value("title", "");
                fc.dayOfWeek = item.value("dayOfWeek", "");
                fc.startTime = item.value("startTime", "");
                fc.endTime = item.value("endTime", "");
                currentConfig.fixedCommitments.push_back(fc);
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "Erreur lors de la lecture du JSON : " << e.what() << std::endl;
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

    std::ofstream file(configFilePath);
    if (!file.is_open()) {
        std::cerr << "Impossible d'ecrire dans le fichier : " << configFilePath << std::endl;
        return false;
    }

    file << j.dump(4); // L'argument 4 ajoute des indentations pour que le fichier texte soit beau à lire
    return true;
}

AppConfig& CerveauConfig::getConfig() {
    return currentConfig;
}

void CerveauConfig::setConfig(const AppConfig& newConfig) {
    currentConfig = newConfig;
}
