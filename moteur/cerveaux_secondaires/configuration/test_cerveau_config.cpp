#include "CerveauConfig.h"
#include <iostream>
#include <cassert> // La bibliothèque C++ standard pour les tests de débogage ("Assertions")

void test_sauvegarde_et_lecture() {
    std::cout << "--- Debut du Test Unitaire : Sauvegarde et Lecture ---" << std::endl;
    
    std::string testFile = "test_config.json";
    CerveauConfig cerveau(testFile);

    // 1. Modification des paramètres par défaut
    AppConfig& config = cerveau.getConfig();
    config.targetGrade = 18.5f; // On vise haut !
    config.summerStudyHoursCompleted = 120; // Étudiant très sérieux cet été
    config.theme = "light";

    // Ajout d'une matière test avec les multiples dates d'examens demandées
    Subject maths;
    maths.name = "Mathematiques";
    maths.color = "Bleu";
    maths.examDates = {"15-10-2026", "20-12-2026", "10-05-2027"};
    config.subjects.push_back(maths);

    FixedCommitment cmPhysique;
    cmPhysique.title = "CM Physique Appliquee";
    cmPhysique.dayOfWeek = "Lundi";
    cmPhysique.startTime = "08:00";
    cmPhysique.endTime = "10:00";
    config.fixedCommitments.push_back(cmPhysique);

    // 2. Sauvegarde (Écriture sur le disque dur)
    bool saved = cerveau.saveConfig();
    assert(saved == true); // Test unitaire : l'exécution s'arrête si ça échoue (crashe)
    std::cout << "[OK] Configuration sauvegardee sur le disque." << std::endl;

    // 3. On crée un NOUVEAU cerveau qui va simuler un redémarrage de l'application
    CerveauConfig cerveauRedemarrage(testFile);
    
    // Au départ, ce nouveau cerveau a les valeurs par défaut
    assert(cerveauRedemarrage.getConfig().targetGrade == 14.0f);
    
    // On lui demande de lire le fichier qu'on vient de créer
    bool loaded = cerveauRedemarrage.loadConfig();
    assert(loaded == true);
    std::cout << "[OK] Configuration rechargee depuis le disque." << std::endl;

    // 4. On vérifie que les données lues sont exactement celles qu'on avait sauvegardées
    AppConfig& loadedConfig = cerveauRedemarrage.getConfig();
    
    assert(loadedConfig.targetGrade == 18.5f);
    assert(loadedConfig.summerStudyHoursCompleted == 120);
    assert(loadedConfig.theme == "light");
    assert(loadedConfig.subjects.size() == 1);
    assert(loadedConfig.subjects[0].name == "Mathematiques");
    assert(loadedConfig.subjects[0].examDates.size() == 3);
    assert(loadedConfig.subjects[0].examDates[1] == "20-12-2026");

    assert(loadedConfig.fixedCommitments.size() == 1);
    assert(loadedConfig.fixedCommitments[0].title == "CM Physique Appliquee");
    assert(loadedConfig.fixedCommitments[0].startTime == "08:00");

    std::cout << "[OK] Toutes les donnees (dont les dates d'examens et emplois du temps) correspondent parfaitement !" << std::endl;
    std::cout << "--- Test Unitaire REUSSI ---" << std::endl;
}

int main() {
    test_sauvegarde_et_lecture();
    return 0;
}
