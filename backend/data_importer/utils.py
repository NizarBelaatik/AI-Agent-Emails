# utils.py
import re
from email_validator import validate_email, EmailNotValidError

def check_mail_with_validator(email):
    """
    Use email-validator library for basic syntax validation
    """
    try:
        valid = validate_email(email)
        return True, "Email valide"
    except EmailNotValidError as e:
        return False, str(e)

def ValidateEmail(email):
    """
    Validate email format and domain
    Returns (is_valid, reason)
    """
    if not email or not isinstance(email, str):
        return False, "Email vide ou invalide"
    
    email = email.strip().lower()
    
    # First, use the email-validator library for syntax checking
    is_valid_syntax, syntax_error = check_mail_with_validator(email)
    if not is_valid_syntax:
        return False, f"Format invalide: {syntax_error}"
    
    # Block only obvious disposable email domains (not business domains)
    disposable_domains = [
        'yopmail.com', 'tempmail.com', 'guerrillamail.com', 'mailinator.com',
        '10minutemail.com', 'throwawaymail.com', 'fakeinbox.com', 'temp-mail.org',
        'trashmail.com', 'sharklasers.com', 'spambox.com', 'mailnator.com',
        'getnada.com', 'tempinbox.com', 'fakemailgenerator.com'
    ]
    
    domain = email.split('@')[1].lower()
    if domain in disposable_domains:
        return False, "Domaine d'email jetable (disposable)"
    
    # DO NOT block role-based emails for business contacts
    # Role-based emails like contact@, info@, support@ are common and valid for businesses
    
    return True, "Email valide"


def validate_recipient_batch(recipients):
    """
    Validate a batch of recipients and categorize them
    Returns (valid_recipients, invalid_recipients, reasons)
    """
    valid = []
    invalid = []
    reasons = {}
    
    for recipient in recipients:
        if recipient.email:
            is_valid, reason = ValidateEmail(recipient.email)
            if is_valid:
                valid.append(recipient)
            else:
                invalid.append(recipient)
                reasons[recipient.id] = reason
        else:
            invalid.append(recipient)
            reasons[recipient.id] = "Email manquant"
    
    print(f'\n[VALIDATION] Valid: {len(valid)}, Invalid: {len(invalid)}')
    if invalid:
        print(f'[VALIDATION] Invalid reasons: {reasons}')
    
    return valid, invalid, reasons