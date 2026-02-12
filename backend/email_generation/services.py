import ollama
import jinja2
import json
import re

from django.utils import timezone
from django.conf import settings
from django.db import transaction, IntegrityError

from .models import EmailTemplate
from data_importer.models import Recipient


def get_or_generate_template(category_name: str, force=False):
    """
    Récupère un template existant ou en génère un nouveau via Ollama.
    """
    template = EmailTemplate.objects.filter(category_name=category_name).first()

    if template and not force:
        return template

    prompt = f"""
Tu es un expert copywriter B2B au Maroc. Ton style est professionnel, courtois et orienté valeur.

Catégorie d'activité : {category_name}

Génère un template email professionnel en français.

**RÈGLE STRICTE** : utilise TOUJOURS la syntaxe Jinja2 avec doubles accolades : {{{{ variable }}}}  
N'utilise JAMAIS de simples accolades {{ variable }}.

Variables disponibles :
{{{{ recipient.name }}}}
{{{{ recipient.company_name }}}}
{{{{ recipient.city }}}}
{{{{ recipient.x_activitec }}}}

Réponds UNIQUEMENT en JSON valide :
{{
  "subject": "Sujet avec {{{{ recipient.name }}}} par exemple",
  "body": "<p>Corps en HTML avec {{{{ recipient.name }}}} et {{{{ recipient.city }}}}</p>"
}}
"""

    print(f"[OLLAMA] Generating template for: {category_name}")

    try:
        response = ollama.chat(
            model=settings.OLLAMA_MODEL_NAME or "phi3:mini",
            messages=[{'role': 'user', 'content': prompt}],
            format="json",
        )
        data = json.loads(response['message']['content'])
    except Exception as e:
        print(f"[OLLAMA ERROR] {e}")
        data = {
            "subject": "Bonjour {{ recipient.name }},",
            "body": "<p>Message personnalisé pour {{ recipient.name }} à {{ recipient.city }}.</p>"
        }

    try:
        with transaction.atomic():
            template = EmailTemplate.objects.create(
                category_name=category_name,
                subject_template=data["subject"],
                body_template=data["body"],
                is_generated=True,
                generated_at=timezone.now(),
                model_used=settings.OLLAMA_MODEL_NAME or "phi3:mini",
                prompt_used=prompt
            )
            print(f"[TEMPLATE CREATED] {template}")
    except IntegrityError:
        template = EmailTemplate.objects.get(category_name=category_name)
        print(f"[TEMPLATE ALREADY EXISTS] {template}")

    return template

def render_email(template: EmailTemplate, recipient: Recipient):
    """
    Rend le template avec conversion intelligente des accolades.
    """
    import re
    
    def normalize_template(raw_text):
        """
        Convertit les deux formats possibles en Jinja2 valide.
        """
        # Si déjà au format {{ var }} (avec doubles accolades et espaces)
        if '{{' in raw_text and '}}' in raw_text:
            return raw_text
        
        # Si au format {var} (accolades simples)
        if re.search(r'\{[^}]+\}', raw_text):
            return re.sub(r'\{([^}]+)\}', r'{{ \1 }}', raw_text)
        
        return raw_text

    # Normaliser les templates
    subject_raw = normalize_template(template.subject_template)
    body_raw = normalize_template(template.body_template)

    print(f"[RENDER DEBUG] Original subject: {template.subject_template[:100]}")
    print(f"[RENDER DEBUG] Normalized subject: {subject_raw[:100]}")

    context = {
        "recipient": recipient,
        "name": recipient.name or recipient.complete_name or "",
        "company_name": recipient.company_name or recipient.name or "",
        "city": recipient.city or "",
        "x_activitec": getattr(recipient, "x_activitec", ""),
        "x_forme_juridique": getattr(recipient, "x_forme_juridique", ""),
        "x_ice": getattr(recipient, "x_ice", ""),
    }

    env = jinja2.Environment(autoescape=True)

    try:
        subject = env.from_string(subject_raw).render(**context)
        body_html = env.from_string(body_raw).render(**context)
        print(f"[RENDER SUCCESS] Subject: {subject[:80]}...")
        return subject.strip(), body_html.strip()
    except jinja2.exceptions.TemplateSyntaxError as e:
        print(f"[JINJA ERROR] {e}")
        print(f"Original subject: {template.subject_template[:200]}")
        print(f"Normalized subject: {subject_raw[:200]}")
        print(f"Original body: {template.body_template[:200]}")
        print(f"Normalized body: {body_raw[:200]}")
        return "Erreur de rendu sujet", "<p>Erreur lors du rendu du template</p>"
    