cmake_minimum_required(VERSION 3.10)
project(ELPIS_Moteur)

set(CMAKE_CXX_STANDARD 17)

# Inclure notre dossier lib où se trouve json.hpp
include_directories(lib)

# Créer l'exécutable de gestion de la Configuration
add_executable(moteur_config 
    moteur/moteur_menu_configuration/CerveauConfig.cpp 
    moteur/moteur_menu_configuration/main_config.cpp
)
