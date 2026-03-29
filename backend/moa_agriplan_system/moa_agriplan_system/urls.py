"""
URL configuration for moa_agriplan_system project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse, JsonResponse
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from indicators.views import SectorViewSet, DepartmentViewSet, IndicatorViewSet, IndicatorGroupViewSet, state_minister_dashboard, hierarchical_spreadsheet
from users.views import MeView, UserViewSet, AdminStatsView, AdminTargetsBySectorView, AdminIndicatorsByDepartmentView, ActivityLogView, ChangePasswordView, MinisterDashboardView, IndicatorPerformanceView, IndicatorDetailView
from plans.views import (
    AnnualPlanViewSet,
    QuarterlyBreakdownViewSet,
    QuarterlyPerformanceViewSet,
    FileAttachmentViewSet,
    SubmissionWindowViewSet,
    AdvisorCommentViewSet,
    submission_window_status,
    submit_to_strategic,
    minister_review_summary,
)

# Health check views
def health_check(request):
    return HttpResponse(status=200)

def api_check(request):
    return JsonResponse({'status': 'ok'})

router = DefaultRouter()
router.register(r'api/sectors', SectorViewSet, basename='sector')
router.register(r'api/departments', DepartmentViewSet, basename='department')
router.register(r'api/indicators', IndicatorViewSet, basename='indicator')
router.register(r'api/indicator-groups', IndicatorGroupViewSet, basename='indicatorgroup')
router.register(r'api/annual-plans', AnnualPlanViewSet, basename='annualplan')
router.register(r'api/breakdowns', QuarterlyBreakdownViewSet, basename='breakdown')
router.register(r'api/performances', QuarterlyPerformanceViewSet, basename='performance')
router.register(r'api/attachments', FileAttachmentViewSet, basename='attachment')
router.register(r'api/users', UserViewSet, basename='user')
router.register(r'api/submission-windows', SubmissionWindowViewSet, basename='submissionwindow')
router.register(r'api/advisor-comments', AdvisorCommentViewSet, basename='advisorcomment')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/token/', obtain_auth_token, name='api-token'),
    path('api/me/', MeView.as_view(), name='api-me'),
    path('api/change-password/', ChangePasswordView.as_view(), name='api-change-password'),
    path('api/admin-stats/', AdminStatsView.as_view(), name='api-admin-stats'),
    path('api/admin-stats/targets-by-sector/', AdminTargetsBySectorView.as_view(), name='api-admin-targets-by-sector'),
    path('api/admin-stats/indicators-by-department/', AdminIndicatorsByDepartmentView.as_view(), name='api-admin-indicators-by-department'),
    path('api/activity-logs/', ActivityLogView.as_view(), name='api-activity-logs'),
    path('api/minister-dashboard/', MinisterDashboardView.as_view(), name='api-minister-dashboard'),
    path('api/state-minister-dashboard/', state_minister_dashboard, name='api-state-minister-dashboard'),
    path('api/indicator-performance/', IndicatorPerformanceView.as_view(), name='api-indicator-performance'),
    path('api/indicator-detail/', IndicatorDetailView.as_view(), name='api-indicator-detail'),
    path('api/submission-windows/status/', submission_window_status, name='api-submission-window-status'),
    path('api/reviews/summary/', minister_review_summary, name='api-minister-review-summary'),
    path('api/reviews/submit-to-strategic/', submit_to_strategic, name='api-submit-to-strategic'),
    path('api/hierarchical-spreadsheet/', hierarchical_spreadsheet, name='api-hierarchical-spreadsheet'),
    path('health/', health_check, name='health'),
    path('api/', api_check, name='api-check'),
    path('', include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
