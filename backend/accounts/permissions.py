from rest_framework.permissions import BasePermission
class ManagerOrAdmin(BasePermission):
 def has_permission(self,request,view): return request.user.is_authenticated and request.user.role in ("SUPER_ADMIN","MANAGER")
class SuperAdmin(BasePermission):
 def has_permission(self,request,view): return request.user.is_authenticated and request.user.role=="SUPER_ADMIN"
