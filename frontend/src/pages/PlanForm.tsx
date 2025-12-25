import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Button, Typography, Paper, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Chip, Stack, Container
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  LockOpen as LockOpenIcon, CheckCircle as CheckCircleIcon, Download as DownloadIcon
} from '@mui/icons-material';
import { useTranslation } from '../i18n/index.tsx';
import Header from '../components/Header';
import {
  getPlanById, deleteItem, updateVersionStatus, exportVersionToExcel,
  PlanStatus
} from '../services/api';
import type { ProcurementPlan, ProcurementPlanVersion, PlanItemVersion } from '../services/api';

// Helper to format currency
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT' }).format(amount);

// Card for displaying statistics
const StatsCard = ({ title, value, color = 'text.primary' }: { title: string; value: React.ReactNode; color?: string; }) => (
  <Paper elevation={1} sx={{ p: 3, textAlign: 'center', height: '100%' }}>
    <Typography variant="h5" sx={{ color, fontWeight: 'bold', mb: 1 }}>{value}</Typography>
    <Typography variant="body2" color="text.secondary">{title}</Typography>
  </Paper>
);

// Section for displaying plan statistics
const StatsSection = ({ version }: { version: ProcurementPlanVersion | null }) => {
  const { t } = useTranslation();
  
  if (!version) {
    return null;
  }

  const ktpPercentage = Number(version.ktp_percentage ?? 0);
  const importPercentage = Number(version.import_percentage ?? 0);
  const totalAmount = Number(version.total_amount ?? 0);

  return (
    <Box sx={{ mt: 4, mb: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
      <StatsCard title={t('ktp_share')} value={`${ktpPercentage.toFixed(2)}%`} color="success.main" />
      <StatsCard title={t('import_share')} value={`${importPercentage.toFixed(2)}%`} color="error.main" />
      <StatsCard title={t('total_amount')} value={formatCurrency(totalAmount)} color="info.main" />
    </Box>
  );
};

// Chip for displaying status
const StatusChip = ({ status }: { status: PlanStatus }) => {
  const { t } = useTranslation();
  const statusMap = {
    [PlanStatus.DRAFT]: { label: t('status_DRAFT'), color: 'info' },
    [PlanStatus.PRE_APPROVED]: { label: t('status_PRE_APPROVED'), color: 'warning' },
    [PlanStatus.APPROVED]: { label: t('status_APPROVED'), color: 'success' },
  };
  const { label, color } = statusMap[status] || statusMap.DRAFT;
  return <Chip label={label} color={color as any} variant="outlined" sx={{ fontWeight: 'bold' }} />;
};

export default function PlanForm() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [plan, setPlan] = useState<ProcurementPlan | null>(null);
  const [activeVersion, setActiveVersion] = useState<ProcurementPlanVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<PlanStatus | null>(null);

  const loadPlan = async () => {
    if (!planId) return;
    try {
      setLoading(true);
      const data = await getPlanById(Number(planId));
      const activeVer = data.versions.find(v => v.is_active);
      setPlan(data);
      setActiveVersion(activeVer || null);
    } catch (err) {
      setError(t('error_loading_plan'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlan();
  }, [planId, t]);

  const handleStatusChange = async () => {
    if (!planId || !nextStatus) return;
    try {
      await updateVersionStatus(Number(planId), nextStatus);
      await loadPlan();
    } catch (err: any) {
      setError(`Ошибка: ${err.response?.data?.detail || err.message}`);
    } finally {
      setConfirmOpen(false);
      setNextStatus(null);
    }
  };

  const handleExport = async () => {
    if (!planId || !activeVersion) return;
    try {
      await exportVersionToExcel(Number(planId), activeVersion.id);
    } catch {
      setError(t('error_exporting_excel'));
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (window.confirm(t('confirm_delete_item'))) {
      try {
        await deleteItem(itemId);
        loadPlan();
      } catch {
        setError(t('error_deleting_item'));
      }
    }
  };

  const openConfirmDialog = (status: PlanStatus) => {
    setNextStatus(status);
    setConfirmOpen(true);
  };

  const isEditable = activeVersion?.status === PlanStatus.DRAFT;

  // Сортируем позиции: сначала активные, потом удаленные
  const sortedItems = useMemo(() => {
    if (!activeVersion?.items) return [];
    return [...activeVersion.items].sort((a, b) => {
      if (a.is_deleted && !b.is_deleted) return 1;
      if (!a.is_deleted && b.is_deleted) return -1;
      return a.item_number - b.item_number;
    });
  }, [activeVersion]);

  if (loading) return <><Header /><Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box></>;
  if (error) return <><Header /><Box sx={{ p: 4 }}><Alert severity="error">{error}</Alert></Box></>;
  if (!plan || !activeVersion) return <><Header /><Box sx={{ p: 4 }}><Alert severity="info">{t('no_plan_data')}</Alert></Box></>;

  return (
    <>
      <Header />
      <Container maxWidth={false} sx={{ py: 4, px: { xs: 2, md: 4 } }}>
        <Paper sx={{ p: 3, mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              {plan.plan_name}
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body1" color="text.secondary">
                  {plan.year}
              </Typography>
              <StatusChip status={activeVersion.status} />
              <Typography variant="subtitle1" color="text.secondary">
                (v{activeVersion.version_number})
              </Typography>
            </Stack>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport}>
              {t('export_to_excel')}
            </Button>
            {activeVersion.status === PlanStatus.DRAFT && (
              <Button variant="contained" color="warning" startIcon={<LockOpenIcon />} onClick={() => openConfirmDialog(PlanStatus.PRE_APPROVED)}>
                {t('pre_approve')}
              </Button>
            )}
            {activeVersion.status === PlanStatus.PRE_APPROVED && (
              <Button variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={() => openConfirmDialog(PlanStatus.APPROVED)}>
                {t('approve_final')}
              </Button>
            )}
          </Stack>
        </Paper>

        <StatsSection version={activeVersion} />

        <Box sx={{ mt: 5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} px={2}>
            <Typography variant="h5" fontWeight="500">
              {t('plan_items_title')} ({activeVersion.items?.length || 0})
            </Typography>
            {isEditable && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate(`/plans/${planId}/items/new`)}>
                {t('add_item')}
              </Button>
            )}
          </Stack>

          <Paper sx={{ width: '100%', overflow: 'hidden', mb: 4 }}>
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>№</TableCell>
                    <TableCell>{t('item_name')}</TableCell>
                    <TableCell>{t('is_ktp')}</TableCell>
                    <TableCell align="right">{t('item_quantity')}</TableCell>
                    <TableCell align="right">{t('item_price')}</TableCell>
                    <TableCell align="right">{t('total_amount')}</TableCell>
                    {isEditable && <TableCell align="center">{t('actions')}</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedItems.length > 0 ? (
                    sortedItems.map((item: PlanItemVersion) => (
                      <TableRow 
                        key={item.id} 
                        hover
                        sx={{
                          backgroundColor: item.is_deleted ? '#f5f5f5' : 'inherit',
                          '& .MuiTableCell-root': {
                            color: item.is_deleted ? 'text.disabled' : 'inherit',
                            textDecoration: item.is_deleted ? 'line-through' : 'none',
                          },
                        }}
                      >
                        <TableCell>{item.item_number}</TableCell>
                        <TableCell>{item.enstru?.name_ru || t('no_name')}</TableCell>
                        <TableCell>
                          <Chip label={item.is_ktp ? t('yes') : t('no')} color={item.is_ktp ? "success" : "default"} size="small" disabled={item.is_deleted} />
                        </TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(item.price_per_unit)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(item.total_amount)}</TableCell>
                        {isEditable && (
                          <TableCell align="center">
                            {!item.is_deleted && (
                              <>
                                <IconButton size="small" onClick={() => navigate(`/items/${item.id}/edit`)} color="primary">
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={() => handleDeleteItem(item.id)} color="error">
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={isEditable ? 7 : 6} align="center" sx={{ py: 3 }}>
                        <Typography color="text.secondary">{t('no_items_in_plan')}</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      </Container>

      <Dialog open={isConfirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{t('confirm_status_change_title')}</DialogTitle>
        <DialogContent><DialogContentText>{t('confirm_status_change_body')}</DialogContentText></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>{t('cancel')}</Button>
          <Button onClick={handleStatusChange} variant="contained" autoFocus>{t('confirm')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
