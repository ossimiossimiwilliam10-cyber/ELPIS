cmake_minimum_required(VERSION 3.10)
project(ELPIS_Moteur)

set(CMAKE_CXX_STANDARD 17)

# Inclure notre dossier lib où se trouve json.hpp
include_directories(lib)

# Créer l'exécutable de test pour le Cerveau Configuration
add_executable(test_config 
    moteur/moteur_menu_configuration/CerveauConfig.cpp 
    moteur/moteur_menu_configuration/test_cerveau_config.cpp
)
