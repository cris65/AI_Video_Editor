# 📘 VISION

**Version:** v0.1.67 - 2026-05-24

> [!NOTE]
> AG: Local-First project for AI Video Editing focused on offline automation and high professional standards (zero cloud dependencies).

## The "Symmetrical EDL Workflow" Model

The system architecture is based on a symmetrical workflow based solely on the industry standard **EDL CMX3600**, ensuring native and exact communication with Adobe Premiere Pro (or any similar NLE). 

The lifecycle of the project involves:
1. **Symmetrical Ingest:** The engine imports the temporal map of the sequence exported from Premiere via `.edl` files.
2. **AI Processing:** Through advanced YOLOv8n models and OpenCV algorithms, the system scans the offline proxy, dynamically classifying the footage into a *Main Track* (solos) and a *B-Roll Track* (details and coverage), with adaptive "Dynamic Backtrack" filters for motion/blur tolerance.
3. **Symmetrical Export:** The AI regenerates the decision timeline, packaging a new outgoing `.edl` file, which will reinject the pre-edited sequence back into the NLE, automatically and surgically reconnecting it to the original high-resolution RAW files (via native CMX3600 comments).

This ecosystem allows human editors to drastically reduce pre-selection time while keeping data management strictly local, secure, and fully aligned with broadcast-grade 50fps television and cinema workflows.

## The Endgame: Adobe Premiere CEP Plugin

The ultimate goal of the project is not a standalone web app, but the transformation of the entire React frontend into a native extension (CEP Panel) running directly inside Adobe Premiere Pro.
User interaction and system integration will happen by silently importing and exporting EDL files, leveraging the integrated Node.js environment in CEP panels to drive the local Python Engine directly, making the workflow completely transparent and integrated for the editor.
