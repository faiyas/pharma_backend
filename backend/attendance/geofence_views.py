import math
from datetime import date, datetime
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from shops.models import Shop, Employee, ShopManager
from .models import Event

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000  # radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def get_permitted_shops(user):
    if user.role == "SUPER_ADMIN":
        return Shop.objects.all()
    elif user.role == "MANAGER":
        return Shop.objects.filter(manager_links__manager=user)
    elif user.role == "EMPLOYEE":
        return Shop.objects.filter(employees__user=user)
    return Shop.objects.none()

class GeofenceBranchesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        shops = get_permitted_shops(request.user).prefetch_related("employees", "manager_links__manager")
        data = []
        for s in shops:
            managers = [link.manager.username for link in s.manager_links.all()]
            data.append({
                "id": s.id,
                "name": s.name,
                "code": s.code,
                "address": s.address,
                "latitude": s.latitude,
                "longitude": s.longitude,
                "allowed_radius_m": s.allowed_radius_m,
                "employee_count": s.employees.filter(is_active=True).count(),
                "managers": managers,
                "is_active": s.is_active,
            })
        return Response(data)

class GeofencePunchesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        shops = get_permitted_shops(user)

        shop_id = request.query_params.get("shop_id")
        date_str = request.query_params.get("date")
        employee_id = request.query_params.get("employee_id")
        status_filter = request.query_params.get("status") # 'accepted', 'rejected', or 'all'

        if shop_id:
            shops = shops.filter(id=shop_id)

        qs = Event.objects.filter(shop__in=shops)

        if user.role == "EMPLOYEE":
            qs = qs.filter(employee__user=user)

        if date_str:
            try:
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                qs = qs.filter(created_at__date=target_date)
            except ValueError:
                pass
        else:
            qs = qs.filter(created_at__date=date.today())

        if employee_id:
            qs = qs.filter(employee_id=employee_id)

        if status_filter == "accepted":
            qs = qs.filter(accepted=True)
        elif status_filter == "rejected":
            qs = qs.filter(accepted=False)

        qs = qs.select_related("employee__user", "shop").order_by("-created_at")[:200]

        punches = []
        for ev in qs:
            u = ev.employee.user
            # Backend Haversine distance verification check
            calc_dist = haversine_distance(ev.latitude, ev.longitude, ev.shop.latitude, ev.shop.longitude)
            is_suspicious = False
            if ev.accuracy_m > 200 or abs(calc_dist - ev.distance_m) > 50:
                is_suspicious = True

            punches.append({
                "id": ev.id,
                "employee_id": ev.employee.id,
                "employee_code": ev.employee.code,
                "employee_name": u.get_full_name() or u.username,
                "shop_id": ev.shop.id,
                "shop_name": ev.shop.name,
                "shop_code": ev.shop.code,
                "shop_lat": ev.shop.latitude,
                "shop_lng": ev.shop.longitude,
                "shop_radius": ev.shop.allowed_radius_m,
                "kind": ev.kind,
                "timestamp": timezone.localtime(ev.created_at).isoformat(),
                "latitude": ev.latitude,
                "longitude": ev.longitude,
                "accuracy_m": round(ev.accuracy_m, 1),
                "distance_m": round(ev.distance_m, 1),
                "calculated_distance_m": round(calc_dist, 1),
                "accepted": ev.accepted,
                "reason": ev.reason,
                "is_suspicious": is_suspicious,
            })

        return Response(punches)
