import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Button, Typography, Paper, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Grid,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Chip, Stack
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, CheckCircle as CheckCircleIcon, Lock as LockIcon, Download as DownloadIcon } from '@mui/icons-material';
import { useTranslation } from '../i18n/index.tsx';
import Header from '../components/Header';
import { getSmetaById, deleteItem, updateSmetaStatus, exportSmetaToExcel, PlanStatus } from '../services/api';
import type { Smeta, SmetaItem } from '../services/api';

// --- Вспомогательные компоненты ---

const StatsCard = ({ title, value, color = 'grey.700' }: { title: string, value: string | number, color?: string }) => (
  <Paper sx={{ p: 2, textAlign: 'center', height: '100%' }}>
    <Typography variant="h6" color={color} fontWeight="bold">{value}</Typography>
    <Typography variant="body2">{title}</Typography>
  </Paper>
);

const ConfirmDialog = ({ open, onClose, onConfirm, title, children }: any) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>{title}</DialogTitle>
    <DialogContent><DialogContentText>{children}</DialogContentText></DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Отмена</Button>
      <Button onClick={onConfirm} color="primary" autoFocus>Подтвердить</Button>
    </DialogActions>
  </Dialog>
);

const StatusChip = ({ status }: { status: PlanStatus }) => {
    const { t } = useTranslation();
    const statusMap = {
        [PlanStatus.DRAFT]: { label: t('status_draft'), color: 'default' },
        [PlanStatus.PRE_APPROVED]: { label: t('status_pre_approved'), color: 'warning' },
        [PlanStatus.APPROVED]: { label: t('status_approved'), color: 'success' },
    };
    const { label, color } = statusMap[status] || statusMap.DRAFT;
    return <Chip label={label} color={color as any} />;
};


export default function SmetaForm() {
  const { smetaId } = useParams<{ smetaId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [smeta, setSmeta] = useState<Smeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<PlanStatus | null>(null);

  useEffect(() => {
    if (smetaId) loadSmeta();
    else navigate('/');
  }, [smetaId]);

  const loadSmeta = async () => {
    if (!smetaId) return;
    try {
      setLoading(true);
      const data = await getSmetaById(Number(smetaId));
      setSmeta(data);
    } catch (err) { setError('Не удалось загрузить смету.'); }
    finally { setLoading(false); }
  };

  const handleStatusChange = async () => {
    if (!smetaId || !nextStatus) return;
    try {
      await updateSmetaStatus(Number(smetaId), nextStatus);
      loadSmeta();
    } catch (err) {
      setError(`Ошибка при смене статуса: ${err.response?.data?.detail || err.message}`);
    } finally {
      setDialogOpen(false);
      setNextStatus(null);
    }
  };

  const handleExport = async () => {
    if (!smetaId) return;
    try {
        await exportSmetaToExcel(Number(smetaId));
    } catch (err) {
        setError('Ошибка при выгрузке в Excel.');
    }
  };

  const openConfirmDialog = (status: PlanStatus) => {
    setNextStatus(status);
    setDialogOpen(true);
  };

  const handleDeleteItem = async (itemId: number) => {
      if (window.confirm('Вы уверены, что хотите удалить эту позицию?')) {
          try {
              await deleteItem(itemId);
              loadSmeta();
          } catch(err) { setError('Ошибка при удалении'); }
      }
  }

  // --- Расчеты и флаги ---
  const isFullyLocked = smeta?.status === PlanStatus.APPROVED;

  const totalAmount = smeta?.total_amount || 0;
  const ktpAmount = smeta?.ktp_amount || 0;
  const importAmount = totalAmount - ktpAmount;
  const ktpPercentage = totalAmount > 0 ? ((ktpAmount / totalAmount) * 100).toFixed(2) : '0.00';
  const importPercentage = totalAmount > 0 ? ((importAmount / totalAmount) * 100).toFixed(2) : '0.00';

  if (loading) return <><Header /><CircularProgress /></>;
  if (error) return <><Header /><Alert severity="error">{error}</Alert></>;
  if (!smeta) return <><Header /><Alert severity="info">Смета не найдена.</Alert></>;

  return (
    <>
      <Header />
      <Box sx={{ py: 4 }}>
        {/* Заголовок и кнопки - с padding */}
        <Box sx={{ px: 4, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                  <Typography variant="h4" fontWeight="bold" gutterBottom>
                  {t('smeta_form_title', { year: smeta.year })}
                  </Typography>
                  <StatusChip status={smeta.status} />
              </Box>
              <Stack direction="row" spacing={2}>
                  {smeta.status !== PlanStatus.DRAFT && (
                      <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport}>
                          Выгрузить в Excel
                      </Button>
                  )}
                  {smeta.status === PlanStatus.DRAFT && (
                      <Button variant="contained" color="warning" startIcon={<CheckCircleIcon />} onClick={() => openConfirmDialog(PlanStatus.PRE_APPROVED)}>
                          Предварительно утвердить
                      </Button>
                  )}
                  {smeta.status === PlanStatus.PRE_APPROVED && (
                      <Button variant="contained" color="success" startIcon={<LockIcon />} onClick={() => openConfirmDialog(PlanStatus.APPROVED)}>
                          Окончательно утвердить
                      </Button>
                  )}
              </Stack>
          </Box>
        </Box>

        {/* Блоки статистики - на полную ширину */}
        {!isFullyLocked && (
            <Box sx={{ mt: 4 }}>
                <Box sx={{ px: 4, mb: 1 }}>
                  <Typography variant="h6">Текущие расчетные данные</Typography>
                </Box>
                <Box sx={{ px: 2 }}>
                  <Grid container spacing={2}>
                      <Grid item xs={12} sm={4}><StatsCard title="Процент КТП" value={`${ktpPercentage}%`} color="success.main" /></Grid>
                      <Grid item xs={12} sm={4}><StatsCard title="Процент Импорта" value={`${importPercentage}%`} color="warning.main" /></Grid>
                      <Grid item xs={12} sm={4}><StatsCard title="Общая сумма" value={new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT' }).format(totalAmount)} color="info.main" /></Grid>
                  </Grid>
                </Box>
            </Box>
        )}

        {smeta.pre_approved_total_amount != null && (
            <Box sx={{ mt: 4 }}>
                <Box sx={{ px: 4, mb: 1 }}>
                  <Typography variant="h6">Предварительно утвержденные данные</Typography>
                </Box>
                <Box sx={{ px: 2 }}>
                  <Grid container spacing={2}>
                      <Grid item xs={12} sm={4}><StatsCard title="Процент КТП" value={`${smeta.pre_approved_ktp_percentage || 0}%`} /></Grid>
                      <Grid item xs={12} sm={4}><StatsCard title="Процент Импорта" value={`${smeta.pre_approved_import_percentage || 0}%`} /></Grid>
                      <Grid item xs={12} sm={4}><StatsCard title="Общая сумма" value={new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT' }).format(smeta.pre_approved_total_amount)} /></Grid>
                  </Grid>
                </Box>
            </Box>
        )}

        {smeta.final_total_amount != null && (
            <Box sx={{ mt: 4 }}>
                <Box sx={{ px: 4, mb: 1 }}>
                  <Typography variant="h6">Финальные данные</Typography>
                </Box>
                <Box sx={{ px: 2 }}>
                  <Grid container spacing={2}>
                      <Grid item xs={12} sm={4}><StatsCard title="Процент КТП" value={`${smeta.final_ktp_percentage || 0}%`} color="success.dark" /></Grid>
                      <Grid item xs={12} sm={4}><StatsCard title="Процент Импорта" value={`${smeta.final_import_percentage || 0}%`} color="warning.dark" /></Grid>
                      <Grid item xs={12} sm={4}><StatsCard title="Общая сумма" value={new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT' }).format(smeta.final_total_amount)} color="info.dark" /></Grid>
                  </Grid>
                </Box>
            </Box>
        )}

        {/* Таблица позиций - с padding */}
        <Box sx={{ px: 4, mt: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5">{t('smeta_items_title')}</Typography>
              {!isFullyLocked && <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate(`/plans/${smetaId}/items/new`)}>{t('add_item')}</Button>}
          </Box>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('item_number_short')}</TableCell>
                  <TableCell>{t('item_name')}</TableCell>
                  <TableCell>КТП</TableCell>
                  <TableCell>{t('item_quantity')}</TableCell>
                  <TableCell>{t('item_price')}</TableCell>
                  <TableCell>{t('smeta_amount')}</TableCell>
                  {!isFullyLocked && <TableCell align="right">{t('actions')}</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {smeta.items.map((item: SmetaItem) => (
                  <TableRow key={item.id} sx={{ backgroundColor: item.is_ktp ? '#e8f5e9' : 'inherit' }}>
                      <TableCell>{item.item_number}</TableCell>
                      <TableCell>{item.enstru.name_ru}</TableCell>
                      <TableCell>{item.is_ktp ? 'Да' : 'Нет'}</TableCell>
                      <TableCell>{String(item.quantity)}</TableCell>
                      <TableCell>{String(item.price_per_unit)}</TableCell>
                      <TableCell>{String(item.total_amount)}</TableCell>
                      {!isFullyLocked && (
                          <TableCell align="right">
                              <IconButton size="small" onClick={() => navigate(`/items/${item.id}/edit`)}><EditIcon /></IconButton>
                              <IconButton size="small" color="error" onClick={() => handleDeleteItem(item.id)}><DeleteIcon /></IconButton>
                          </TableCell>
                      )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>
      <ConfirmDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleStatusChange}
        title="Подтверждение действия"
      >
        Вы уверены, что хотите изменить статус сметы?
      </ConfirmDialog>
    </>
  );
}