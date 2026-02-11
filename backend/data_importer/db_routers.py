class SourceRouter:
    """
    Routes:
    - SourcePartner   → source_db (read only)
    - Recipient       → default (sqlite)
    - Everything else → default
    """

    def db_for_read(self, model, **hints):
        if model._meta.app_label == 'data_importer':
            if model._meta.model_name == 'sourcepartner':
                return 'source_db'
        return 'default'

    def db_for_write(self, model, **hints):
        if model._meta.app_label == 'data_importer':
            if model._meta.model_name == 'sourcepartner':
                return None   # forbid writes to source
        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        # Allow relations within same db
        db1 = self.db_for_read(obj1._meta.model)
        db2 = self.db_for_read(obj2._meta.model)
        return db1 == db2 if db1 and db2 else None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if app_label == 'data_importer':
            if model_name == 'sourcepartner':
                return db == 'source_db'
            return db == 'default'
        return db == 'default'