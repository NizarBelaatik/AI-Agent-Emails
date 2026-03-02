# Add this function to your views.py or create a new file utils_import.py

def run_import_background(task_id, selected_ids):
    """
    Run import in background thread
    """
    from django.db import transaction
    from .models import ImportTask, SourcePartner, Recipient
    from .utils import validate_recipient_batch
    import logging
    from django.utils import timezone

    
    logger = logging.getLogger(__name__)
    
    try:
        # Update task status
        task = ImportTask.objects.get(task_id=task_id)
        task.status = 'PROGRESS'
        task.started_at = timezone.now()
        task.save()
        
        # Get source partners
        source_partners = SourcePartner.objects.using('source_db').filter(id__in=selected_ids)
        total = source_partners.count()
        
        # Process in batches
        batch_size = 100
        imported = 0
        updated = 0
        failed = 0
        invalid_emails = []
        
        for i in range(0, total, batch_size):
            batch = source_partners[i:i+batch_size]
            
            # Validate emails in batch
            valid_recipients, invalid_recipients, reasons = validate_recipient_batch(batch)
            
            # Store invalid emails
            for sp in invalid_recipients:
                invalid_emails.append({
                    'id': sp.id,
                    'name': sp.name or sp.complete_name,
                    'email': sp.email,
                    'reason': reasons.get(sp.id, "Email invalide")
                })
            
            # Import valid recipients
            for sp in valid_recipients:
                try:
                    with transaction.atomic():
                        recipient, created = Recipient.objects.update_or_create(
                            source_id=sp.id,
                            defaults={
                                # Core fields
                                'name': sp.name,
                                'complete_name': sp.complete_name,
                                'email': sp.email,
                                'phone': sp.phone,
                                'mobile': sp.mobile,
                                'city': sp.city,
                                'street': sp.street,
                                'street2': sp.street2,
                                'zip': sp.zip,
                                'active': sp.active,
                                'is_company': sp.is_company,
                                
                                # Custom x_ fields
                                'x_activitec': sp.x_activitec,
                                'x_ice': sp.x_ice,
                                'x_source': sp.x_source,
                                'x_Capital': sp.x_Capital,
                                'x_effectif': sp.x_effectif,
                                'x_forme_juridique': sp.x_forme_juridique,
                                'x_RC': sp.x_RC,
                                'x_IF': sp.x_IF,
                                
                                # All remaining Odoo fields
                                'company_id': sp.company_id,
                                'create_date': sp.create_date,
                                'title': sp.title,
                                'parent_id': sp.parent_id,
                                'user_id': sp.user_id,
                                'state_id': sp.state_id,
                                'country_id': sp.country_id,
                                'industry_id': sp.industry_id,
                                'color': sp.color,
                                'commercial_partner_id': sp.commercial_partner_id,
                                'create_uid': sp.create_uid,
                                'write_uid': sp.write_uid,
                                'ref': sp.ref,
                                'lang': sp.lang,
                                'tz': sp.tz,
                                'vat': sp.vat,
                                'company_registry': sp.company_registry,
                                'website': sp.website,
                                'function': sp.function,
                                'type': sp.type,
                                'commercial_company_name': sp.commercial_company_name,
                                'company_name': sp.company_name,
                                'barcode': sp.barcode,
                                'comment': sp.comment,
                                'partner_latitude': sp.partner_latitude,
                                'partner_longitude': sp.partner_longitude,
                                'partner_share': sp.partner_share,
                                'write_date': sp.write_date,
                                'message_bounce': sp.message_bounce,
                                'email_normalized': sp.email_normalized,
                                'signup_type': sp.signup_type,
                                'specific_property_product_pricelist': sp.specific_property_product_pricelist,
                                'partner_gid': sp.partner_gid,
                                'additional_info': sp.additional_info,
                                'phone_sanitized': sp.phone_sanitized,
                                'invoice_template_pdf_report_id': sp.invoice_template_pdf_report_id,
                                'supplier_rank': sp.supplier_rank,
                                'customer_rank': sp.customer_rank,
                                'invoice_warn': sp.invoice_warn,
                                'autopost_bills': sp.autopost_bills,
                                'credit_limit': sp.credit_limit,
                                'property_account_payable_id': sp.property_account_payable_id,
                                'property_account_receivable_id': sp.property_account_receivable_id,
                                'property_account_position_id': sp.property_account_position_id,
                                'property_payment_term_id': sp.property_payment_term_id,
                                'property_supplier_payment_term_id': sp.property_supplier_payment_term_id,
                                'trust': sp.trust,
                                'ignore_abnormal_invoice_date': sp.ignore_abnormal_invoice_date,
                                'ignore_abnormal_invoice_amount': sp.ignore_abnormal_invoice_amount,
                                'invoice_sending_method': sp.invoice_sending_method,
                                'invoice_edi_format_store': sp.invoice_edi_format_store,
                                'property_outbound_payment_method_line_id': sp.property_outbound_payment_method_line_id,
                                'property_inbound_payment_method_line_id': sp.property_inbound_payment_method_line_id,
                                'invoice_warn_msg': sp.invoice_warn_msg,
                                'debit_limit': sp.debit_limit,
                                'peppol_endpoint': sp.peppol_endpoint,
                                'peppol_eas': sp.peppol_eas,
                                'sale_warn': sp.sale_warn,
                                'sale_warn_msg': sp.sale_warn_msg,
                                'calendar_last_notif_ack': sp.calendar_last_notif_ack,
                                'website_id': sp.website_id,
                                'is_published': sp.is_published,
                                'date_localization': sp.date_localization,
                                'buyer_id': sp.buyer_id,
                                'purchase_warn': sp.purchase_warn,
                                'property_purchase_currency_id': sp.property_purchase_currency_id,
                                'receipt_reminder_email': sp.receipt_reminder_email,
                                'reminder_date_before_receipt': sp.reminder_date_before_receipt,
                                'purchase_warn_msg': sp.purchase_warn_msg,
                                'is_converted_to_lead': sp.is_converted_to_lead,
                                'lead_conversion_date': sp.lead_conversion_date,
                            }
                        )
                        if created:
                            imported += 1
                        else:
                            updated += 1
                except Exception as e:
                    failed += 1
                    logger.error(f"Import failed for ID {sp.id}: {e}")
            
            # Update progress
            task.progress = int((i + len(batch)) / total * 100)
            task.processed = i + len(batch)
            task.save()
        
        # Mark task as completed
        task.status = 'SUCCESS'
        task.completed_at = timezone.now()
        task.result = {
            'imported': imported,
            'updated': updated,
            'failed': failed,
            'invalid': len(invalid_emails),
            'invalid_details': invalid_emails
        }
        task.save()
        
        logger.info(f"Import task {task_id} completed: {imported} imported, {updated} updated, {failed} failed, {len(invalid_emails)} invalid")
        
    except Exception as e:
        logger.error(f"Import task {task_id} failed: {e}")
        try:
            task = ImportTask.objects.get(task_id=task_id)
            task.status = 'FAILURE'
            task.error_message = str(e)
            task.completed_at = timezone.now()
            task.save()
        except:
            pass