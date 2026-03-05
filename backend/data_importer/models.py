from django.db import models

class SourcePartner(models.Model):
    id = models.IntegerField(primary_key=True)

    # Add EVERY field you listed in the serializer
    company_id = models.IntegerField(null=True, blank=True)
    create_date = models.DateTimeField(null=True, blank=True)
    name = models.CharField(max_length=255, null=True, blank=True)
    title = models.IntegerField(null=True, blank=True)  # often FK ID
    parent_id = models.IntegerField(null=True, blank=True)
    user_id = models.IntegerField(null=True, blank=True)
    state_id = models.IntegerField(null=True, blank=True)
    country_id = models.IntegerField(null=True, blank=True)
    industry_id = models.IntegerField(null=True, blank=True)
    color = models.IntegerField(null=True, blank=True)
    commercial_partner_id = models.IntegerField(null=True, blank=True)
    create_uid = models.IntegerField(null=True, blank=True)
    write_uid = models.IntegerField(null=True, blank=True)
    complete_name = models.CharField(max_length=255, null=True, blank=True)
    ref = models.CharField(max_length=255, null=True, blank=True)
    lang = models.CharField(max_length=10, null=True, blank=True)
    tz = models.CharField(max_length=100, null=True, blank=True)
    vat = models.CharField(max_length=50, null=True, blank=True)
    company_registry = models.CharField(max_length=100, null=True, blank=True)
    website = models.CharField(max_length=255, null=True, blank=True)
    function = models.CharField(max_length=255, null=True, blank=True)
    type = models.CharField(max_length=50, null=True, blank=True)
    street = models.CharField(max_length=255, null=True, blank=True)
    street2 = models.CharField(max_length=255, null=True, blank=True)
    zip = models.CharField(max_length=255, null=True, blank=True)
    city = models.CharField(max_length=255, null=True, blank=True)
    email = models.CharField(max_length=255, null=True, blank=True)
    phone = models.CharField(max_length=64, null=True, blank=True)
    mobile = models.CharField(max_length=64, null=True, blank=True)
    commercial_company_name = models.CharField(max_length=255, null=True, blank=True)
    company_name = models.CharField(max_length=255, null=True, blank=True)
    barcode = models.CharField(max_length=255, null=True, blank=True)
    comment = models.TextField(null=True, blank=True)
    partner_latitude = models.FloatField(null=True, blank=True)
    partner_longitude = models.FloatField(null=True, blank=True)
    active = models.BooleanField(default=True)
    employee = models.BooleanField(default=False)
    is_company = models.BooleanField(default=False)
    partner_share = models.BooleanField(default=False)
    write_date = models.DateTimeField(null=True, blank=True)
    message_bounce = models.IntegerField(null=True, blank=True)
    email_normalized = models.CharField(max_length=255, null=True, blank=True)
    signup_type = models.CharField(max_length=255, null=True, blank=True)
    specific_property_product_pricelist = models.IntegerField(null=True, blank=True)
    partner_gid = models.IntegerField(null=True, blank=True)
    additional_info = models.TextField(null=True, blank=True)
    phone_sanitized = models.CharField(max_length=64, null=True, blank=True)
    invoice_template_pdf_report_id = models.IntegerField(null=True, blank=True)
    supplier_rank = models.IntegerField(default=1, null=True, blank=True)
    customer_rank = models.IntegerField(default=1, null=True, blank=True)
    invoice_warn = models.CharField(max_length=255, null=True, blank=True)
    autopost_bills = models.BooleanField(default=False, null=True, blank=True)
    credit_limit = models.FloatField(null=True, blank=True)
    property_account_payable_id = models.IntegerField(null=True, blank=True)
    property_account_receivable_id = models.IntegerField(null=True, blank=True)
    property_account_position_id = models.IntegerField(null=True, blank=True)
    property_payment_term_id = models.IntegerField(null=True, blank=True)
    property_supplier_payment_term_id = models.IntegerField(null=True, blank=True)
    trust = models.CharField(max_length=50, null=True, blank=True)
    ignore_abnormal_invoice_date = models.BooleanField(default=False, null=True, blank=True)
    ignore_abnormal_invoice_amount = models.BooleanField(default=False, null=True, blank=True)
    invoice_sending_method = models.CharField(max_length=255, null=True, blank=True)
    invoice_edi_format_store = models.TextField(null=True, blank=True)
    property_outbound_payment_method_line_id = models.IntegerField(null=True, blank=True)
    property_inbound_payment_method_line_id = models.IntegerField(null=True, blank=True)
    invoice_warn_msg = models.TextField(null=True, blank=True)
    debit_limit = models.FloatField(null=True, blank=True)
    peppol_endpoint = models.CharField(max_length=255, null=True, blank=True)
    peppol_eas = models.CharField(max_length=255, null=True, blank=True)
    sale_warn = models.CharField(max_length=255, null=True, blank=True)
    sale_warn_msg = models.TextField(null=True, blank=True)
    calendar_last_notif_ack = models.DateTimeField(null=True, blank=True)
    website_id = models.IntegerField(null=True, blank=True)
    is_published = models.BooleanField(default=False, null=True, blank=True)
    date_localization = models.DateTimeField(null=True, blank=True)
    buyer_id = models.IntegerField(null=True, blank=True)
    purchase_warn = models.CharField(max_length=255, null=True, blank=True)
    property_purchase_currency_id = models.IntegerField(null=True, blank=True)
    receipt_reminder_email = models.BooleanField(default=False, null=True, blank=True)
    reminder_date_before_receipt = models.IntegerField(null=True, blank=True)
    purchase_warn_msg = models.TextField(null=True, blank=True)
    is_converted_to_lead = models.BooleanField(default=False, null=True, blank=True)
    lead_conversion_date = models.DateTimeField(null=True, blank=True)

    # Your custom x_ fields
    x_ice = models.CharField(max_length=255, null=True, blank=True)
    x_source = models.CharField(max_length=255, null=True, blank=True)
    x_Capital = models.CharField(max_length=255, null=True, blank=True
                                 ,db_column='x_capital'
                                )
    x_activitec = models.CharField(max_length=255, null=True, blank=True) # Category
    x_effectif = models.CharField(max_length=255, null=True, blank=True)
    x_forme_juridique = models.CharField(max_length=255, null=True, blank=True)
    x_RC = models.CharField(max_length=255, null=True, blank=True,db_column="x_rc")
    x_IF = models.CharField(max_length=255, null=True, blank=True, db_column="x_if")

    class Meta:
        managed = False
        db_table = 'res_partner'


class Recipient(models.Model):
    source_id = models.IntegerField(unique=True)

    # Core fields
    name = models.CharField(max_length=255, null=True, blank=True)
    complete_name = models.CharField(max_length=255, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=64, null=True, blank=True)
    mobile = models.CharField(max_length=64, null=True, blank=True)
    city = models.CharField(max_length=255, null=True, blank=True)
    street = models.CharField(max_length=255, null=True, blank=True)
    street2 = models.CharField(max_length=255, null=True, blank=True)
    zip = models.CharField(max_length=255, null=True, blank=True)
    active = models.BooleanField(default=True)
    is_company = models.BooleanField(default=False)

    
    # Email dispatch tracking - NEW FIELD
    email_dispatched = models.BooleanField(default=False)
    email_dispatched_at = models.DateTimeField(null=True, blank=True)
    email_dispatch_count = models.IntegerField(default=0)
    
    # Custom fields (your Odoo x_ fields)
    x_activitec = models.CharField(max_length=255, null=True, blank=True) # Category
    x_ice = models.CharField(max_length=255, null=True, blank=True)
    x_source = models.CharField(max_length=255, null=True, blank=True)
    x_Capital = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        #db_column='x_Capital'
    )    
    
    x_effectif = models.CharField(max_length=255, null=True, blank=True)
    x_forme_juridique = models.CharField(max_length=255, null=True, blank=True)
    x_RC = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        db_column='x_RC'
    )

    x_IF = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        db_column='x_IF'
    )
    
    # All remaining Odoo fields from your list
    company_id = models.IntegerField(null=True, blank=True)
    create_date = models.DateTimeField(null=True, blank=True)
    title = models.IntegerField(null=True, blank=True)               # usually FK → store ID
    parent_id = models.IntegerField(null=True, blank=True)
    user_id = models.IntegerField(null=True, blank=True)
    state_id = models.IntegerField(null=True, blank=True)
    country_id = models.IntegerField(null=True, blank=True)
    industry_id = models.IntegerField(null=True, blank=True)
    color = models.IntegerField(null=True, blank=True)
    commercial_partner_id = models.IntegerField(null=True, blank=True)
    create_uid = models.IntegerField(null=True, blank=True)
    write_uid = models.IntegerField(null=True, blank=True)
    ref = models.CharField(max_length=255, null=True, blank=True)
    lang = models.CharField(max_length=10, null=True, blank=True)
    tz = models.CharField(max_length=100, null=True, blank=True)
    vat = models.CharField(max_length=50, null=True, blank=True)
    company_registry = models.CharField(max_length=100, null=True, blank=True)
    website = models.CharField(max_length=255, null=True, blank=True)
    function = models.CharField(max_length=255, null=True, blank=True)
    type = models.CharField(max_length=50, null=True, blank=True)
    commercial_company_name = models.CharField(max_length=255, null=True, blank=True)
    company_name = models.CharField(max_length=255, null=True, blank=True)
    barcode = models.CharField(max_length=255, null=True, blank=True)
    comment = models.TextField(null=True, blank=True)
    partner_latitude = models.FloatField(null=True, blank=True)
    partner_longitude = models.FloatField(null=True, blank=True)
    partner_share = models.BooleanField(default=False, null=True, blank=True)
    write_date = models.DateTimeField(null=True, blank=True)
    message_bounce = models.IntegerField(null=True, blank=True)
    email_normalized = models.CharField(max_length=255, null=True, blank=True)
    signup_type = models.CharField(max_length=255, null=True, blank=True)
    specific_property_product_pricelist = models.IntegerField(null=True, blank=True)
    partner_gid = models.IntegerField(null=True, blank=True)
    additional_info = models.TextField(null=True, blank=True)
    phone_sanitized = models.CharField(max_length=64, null=True, blank=True)
    invoice_template_pdf_report_id = models.IntegerField(null=True, blank=True)
    supplier_rank = models.IntegerField(default=1, null=True, blank=True)
    customer_rank = models.IntegerField(default=1, null=True, blank=True)
    invoice_warn = models.CharField(max_length=255, null=True, blank=True)
    autopost_bills = models.BooleanField(default=False, null=True, blank=True)
    credit_limit = models.FloatField(null=True, blank=True)
    property_account_payable_id = models.IntegerField(null=True, blank=True)
    property_account_receivable_id = models.IntegerField(null=True, blank=True)
    property_account_position_id = models.IntegerField(null=True, blank=True)
    property_payment_term_id = models.IntegerField(null=True, blank=True)
    property_supplier_payment_term_id = models.IntegerField(null=True, blank=True)
    trust = models.CharField(max_length=50, null=True, blank=True)
    ignore_abnormal_invoice_date = models.BooleanField(default=False, null=True, blank=True)
    ignore_abnormal_invoice_amount = models.BooleanField(default=False, null=True, blank=True)
    invoice_sending_method = models.CharField(max_length=255, null=True, blank=True)
    invoice_edi_format_store = models.TextField(null=True, blank=True)
    property_outbound_payment_method_line_id = models.IntegerField(null=True, blank=True)
    property_inbound_payment_method_line_id = models.IntegerField(null=True, blank=True)
    invoice_warn_msg = models.TextField(null=True, blank=True)
    debit_limit = models.FloatField(null=True, blank=True)
    peppol_endpoint = models.CharField(max_length=255, null=True, blank=True)
    peppol_eas = models.CharField(max_length=255, null=True, blank=True)
    sale_warn = models.CharField(max_length=255, null=True, blank=True)
    sale_warn_msg = models.TextField(null=True, blank=True)
    calendar_last_notif_ack = models.DateTimeField(null=True, blank=True)
    website_id = models.IntegerField(null=True, blank=True)
    is_published = models.BooleanField(default=False, null=True, blank=True)
    date_localization = models.DateTimeField(null=True, blank=True)
    buyer_id = models.IntegerField(null=True, blank=True)
    purchase_warn = models.CharField(max_length=255, null=True, blank=True)
    property_purchase_currency_id = models.IntegerField(null=True, blank=True)
    receipt_reminder_email = models.BooleanField(default=False, null=True, blank=True)
    reminder_date_before_receipt = models.IntegerField(null=True, blank=True)
    purchase_warn_msg = models.TextField(null=True, blank=True)
    is_converted_to_lead = models.BooleanField(default=False, null=True, blank=True)
    lead_conversion_date = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'data_importer_recipient'

    def __str__(self):
        return self.name or f"Recipient #{self.source_id}"
    


class ImportTask(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'En attente'),
        ('PROGRESS', 'En cours'),
        ('SUCCESS', 'Terminé'),
        ('FAILURE', 'Échec'),
        ('CANCELLED', 'Annulé'),
    ]
    
    task_id = models.CharField(max_length=100, unique=True)
    selected_ids = models.JSONField(default=list)
    total_recipients = models.IntegerField(default=0)
    processed = models.IntegerField(default=0)
    progress = models.IntegerField(default=0)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    result = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Import Task {self.task_id[:8]} - {self.status}"




