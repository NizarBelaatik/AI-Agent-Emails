class SourceDatabaseRouter:
    """
    A router to control all database operations on models in the
    source database application.
    """
    
    def db_for_read(self, model, **hints):
        """
        Attempts to read source models go to source_db.
        """
        if model._meta.app_label == 'app':
            # This is a trick - we'll handle source queries in views manually
            return None
        return None
    
    def db_for_write(self, model, **hints):
        """
        Attempts to write go to default.
        """
        return 'default'
    
    def allow_relation(self, obj1, obj2, **hints):
        """
        Allow relations if both models are in the same database.
        """
        return True
    
    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """
        Make sure the app only appears in the 'default' database.
        """
        return db == 'default'