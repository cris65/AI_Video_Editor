# 📘 VISION

> [!NOTE]
> AG: Progetto Local-First per AI Video Editing incentrato su automazione offline e alta professionalità (zero cloud dependencies).

## Il Modello "Symmetrical EDL Workflow"

L'architettura del sistema si fonda su un flusso simmetrico basato unicamente sullo standard industriale **EDL CMX3600**, garantendo una comunicazione nativa ed esatta con Adobe Premiere Pro (o qualsiasi NLE affine). 

Il ciclo vitale del progetto prevede:
1. **Ingestione Simmetrica:** Il motore importa la mappa temporale della sequenza esportata da Premiere tramite file `.edl`.
2. **AI Processing:** Attraverso modelli avanzati YOLOv8n e algoritmi OpenCV, il sistema scansiona il proxy offline, classificando dinamicamente il girato in una *Main Track* (solista) e una *B-Roll Track* (dettagli e coperture), con filtri adattivi di "Dynamic Backtrack" per tolleranza mosso/sfocato.
3. **Esportazione Simmetrica:** L'AI rigenera la timeline delle decisioni confezionando un nuovo file `.edl` in uscita, che re-injetterà nella NLE la sequenza pre-montata ricollegandola automaticamente e chirurgicamente ai file RAW originali ad altissima risoluzione (tramite i commenti CMX3600 nativi).

Questo ecosistema consente al montatore umano di abbattere i tempi di pre-selezione, mantenendo una gestione dei dati strettamente locale, sicura, e pienamente in sintonia con i workflow televisivi e cinematografici broadcast-grade a 50fps.

## L'Endgame: Adobe Premiere CEP Plugin

L'obiettivo finale del progetto non è una web-app standalone, ma la trasformazione dell'intero frontend React in un'estensione nativa (CEP Panel) eseguita direttamente all'interno di Adobe Premiere Pro.
L'interazione con l'utente e il sistema avverrà importando ed esportando silenziosamente i file EDL, sfruttando l'ambiente Node.js integrato nei pannelli CEP per pilotare direttamente in locale il Python Engine, rendendo il flusso di lavoro completamente trasparente e integrato per il montatore.
