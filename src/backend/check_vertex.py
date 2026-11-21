"""Smoke test of the setup: one tiny call per model on Vertex + ElevenLabs check. Run: python check_vertex.py"""
import time

from pydantic import BaseModel

from app.config import settings


class Pong(BaseModel):
    ok: bool
    word: str


def main() -> None:
    print(f"project={settings.project or '(vuoto)'} location={settings.location} mode={settings.llm_mode}")
    if not settings.project:
        print("✗ GOOGLE_CLOUD_PROJECT mancante in .env")
        return
    from google import genai
    from google.genai import types

    client = genai.Client(vertexai=True, project=settings.project, location=settings.location)
    for model in (settings.model, settings.model_lite):
        t0 = time.perf_counter()
        try:
            r = client.models.generate_content(
                model=model, contents="Rispondi ok=true e una parola italiana a caso.",
                config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=Pong),
            )
            u = r.usage_metadata
            print(f"✓ {model}: {r.text.strip()} · {u.prompt_token_count} in / {u.candidates_token_count} out · {(time.perf_counter() - t0) * 1000:.0f} ms")
        except Exception as e:
            print(f"✗ {model}: {e}")
    if settings.tts_enabled:
        from app.services.tts import synthesize

        print("✓ ElevenLabs" if synthesize("Ciao, sono il Brain di Bottega Sabauda.") else "✗ ElevenLabs: controlla chiave e voice id")
    else:
        print("– ElevenLabs non configurato (opzionale)")
    if settings.mail_enabled:
        import smtplib

        from app.services.mailer import mask

        try:  # login only: no email is sent by the check
            cls = smtplib.SMTP_SSL if settings.smtp_port == 465 else smtplib.SMTP
            with cls(settings.smtp_host, settings.smtp_port, timeout=20) as s:
                if settings.smtp_port != 465:
                    s.starttls()
                s.login(settings.smtp_user, settings.smtp_password)
            print(f"✓ Email reale: login SMTP ok, le approvazioni arriveranno a {mask(settings.mail_to)}")
        except Exception as e:
            print(f"✗ Email reale: {type(e).__name__}: {e}")
    else:
        print("– Email reale non configurata (opzionale): le email restano simulate")


if __name__ == "__main__":
    main()
