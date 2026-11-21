# Risorse dell'evento

Portale ufficiale: https://agenthon-portal.gdgtorino.it/app#today (brief, programma, aggiornamenti)

## Google Cloud credits ($30 a persona)
- Claim su **g.dev/credits/devfest-alps-2026** il **sabato mattina, subito prima di iniziare**: durano 12 ore.
- Usare l'account **Gmail personale** (i crediti restano all'account che li riscatta).
- Il saldo si aggiorna dopo circa 1 ora.
- **Usare Gemini via Vertex AI**, NON via Google AI Studio (lì i crediti non vengono usati).
- Scegliere una regione diversa da Torino (`europe-west12`) e Doha (`me-central1`): sono escluse. Es. `europe-west4` o `europe-west1`.

### Coperto dai crediti
- Vertex AI: Gemini, Veo, Nano Banana, Lyria, embeddings, Speech-to-Text, Text-to-Speech, Translation, Vision
- Cloud Run, Cloud Functions, App Engine, Compute Engine (VM standard)
- Firebase (piano Blaze): Hosting, Firestore, Auth, Storage, Functions
- Cloud SQL, Firestore, Cloud Storage (Standard), BigQuery (query)
- Google Maps Platform: Places, Routes, Maps JS API

### Non coperto / a rischio
- Gemini API via AI Studio
- Prodotti di terze parti, **probabilmente anche modelli partner come Claude e Llama su Vertex**
- GKE (usare Cloud Run), GPU/TPU speciali, Spot VM, regioni escluse, cold storage
- Modelli **Preview** (es. Veo 3.1 Lite, qualsiasi `-preview`): testare 1 chiamata e controllare il saldo dopo 1 ora
- Modelli GA ok: `gemini-3.8-flash`, `gemini-3.5-flash`, `gemini-3.1-flash-lite`, `veo-3.1-generate-001`, `veo-3.1-fast-generate-001`

### Cosa comprano $30
| Modello | Costo | Circa |
|---|---|---|
| Gemini 3.8 Flash (testo) | $0.75/M in, $3.75/M out (fino al 31/12; il thinking conta come output) | ~5.700 chiamate da 2k in / 1k out |
| Veo 3.1 con audio | $0.40/s | ~75 s |
| Veo 3.1 senza audio | $0.20/s | ~150 s |
| Veo 3.1 Fast con audio (720p) | $0.10/s | ~300 s |
| Nano Banana 2 Lite | $0.034/img | ~880 |
| Nano Banana 2 | $0.067/img (1K) | ~450 |
| Nano Banana Pro | ~$0.13/img (1K) | ~220 |

Consigli: video = voce di spesa più veloce, provare su clip da 4 s, bozze con Fast/Lite, audio spento se non serve. Nano Banana: circa **1 immagine al minuto per progetto**, pianificare le immagini.

## ElevenLabs (gratis per ogni partecipante)
1. Unirsi al Discord di ElevenLabs, canale `#🎟️│coupon-codes`.
2. Start Redemption → evento "AGENTHON: Waiting for DevFest Alps" → email usata per l'iscrizione.
3. Il bot invia il codice coupon.
- Piano Creator: Image & Video (Veo 3.1, Kling, Seedance) nell'app (via API serve il piano Pro).
- Per la **voce usare l'API**, non le app, per far durare i crediti.
- **Premio speciale per il miglior uso di ElevenLabs.**

## Video pitch fatto interamente con AI (opzionale)
Clip con Veo o ElevenLabs, voice-over con ElevenLabs, montaggio con **HyperFrames** (HeyGen, open source, HTML → MP4): `npx hyperframes skills update` una volta, poi chiedere all'agente di fare il video.
