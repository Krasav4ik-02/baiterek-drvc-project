import { useEffect, useState, useMemo } from 'react'; // React убрал, так как в React 17+ он не нужен в импорте
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Chip,
  Stack,
  Container,
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  Download as DownloadIcon
  // CheckCircleIcon убрал, так как он не использовался и вызывал ошибку
} from '@mui/icons-material';

import { useTranslation } from '../i18n/index.tsx';
import Header from '../components/Header';
import { getSmetaById, deleteItem, updateSmetaStatus, exportSmetaToExcel, PlanStatus } from '../services/api';
import type { Smeta, SmetaItem } from '../services/api';

// Интерфейс пропсов явно указываем как ReactNode для value, чтобы не было ошибки TS2322
const StatsCard = ({
  title,
  value,
  color = 'text.primary',
  bgColor = '#fff'
}: {
  title: string;
  value: React.ReactNode;
  color?: string;
  bgColor?: string;
}) => (
  <Paper
    elevation={1}
    sx={{
      p: 3,
      textAlign: 'center',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: bgColor,
      border: '1px solid',
      borderColor: 'divider'
    }}
  >
    <Typography variant="h5" sx={{ color, fontWeight: 'bold', mb: 1 }}>
      {value}
    </Typography>

    <Typography variant="body2" color="text.secondary">
      {title}
    </Typography>
  </Paper>
);

interface StatsSectionProps {
  title: string;
  ktp: string;
  importPerc: string;
  total: number;
  variant?: 'current' | 'pre_approved' | 'final';
}

const StatsSection = ({
  title,
  ktp,
  importPerc,
  total,
  variant = 'current'
}: StatsSectionProps) => {
  const styles = useMemo(() => {
    if (variant === 'final')
      return {
        ktp: 'success.dark',
        imp: 'warning.dark',
        tot: 'info.dark',
        bg: '#f5fbfb'
      };

    if (variant === 'pre_approved')
      return {
        ktp: 'text.primary',
        imp: 'text.primary',
        tot: 'text.primary',
        bg: '#fff'
      };

    return {
      ktp: 'success.main',
      imp: 'error.main',
      tot: 'info.main',
      bg: '#fff'
    };
  }, [variant]);

  const formattedTotal = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'KZT'
  }).format(total);

  return (
    <Box sx={{ mt: 4, mb: 2, width: '100%' }}>
      <Typography variant="h6" gutterBottom sx={{ px: 0 }}>
        {title}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(3, 1fr)'
          },
          gap: 2,
          width: '100%'
        }}
      >
        <StatsCard
          title="Доля КТП"
          value={`${ktp}%`}
          color={styles.ktp}
        />

        <StatsCard
          title="Доля Импорта"
          value={`${importPerc}%`}
          color={styles.imp}
        />

        <StatsCard
          title="Общая сумма"
          value={formattedTotal}
          color={styles.tot}
          bgColor={styles.bg}
        />
      </Box>
    </Box>
  );
};

// ... ConfirmDialog и StatusChip оставляем без изменений ...
const ConfirmDialog = ({ open, onClose, onConfirm, title, children }: any) => (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent><DialogContentText>{children}</DialogContentText></DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={onConfirm} variant="contained" color="primary" autoFocus>Подтвердить</Button>
      </DialogActions>
    </Dialog>
);

const StatusChip = ({ status }: { status: PlanStatus }) => {
    const { t } = useTranslation();
    const map = {
      [PlanStatus.DRAFT]: { label: t('status_draft'), color: 'default' },
      [PlanStatus.PRE_APPROVED]: { label: t('status_pre_approved'), color: 'warning' },
      [PlanStatus.APPROVED]: { label: t('status_approved'), color: 'success' },
    };
    const conf = map[status] || map[PlanStatus.DRAFT];
    return <Chip label={conf.label} color={conf.color as any} variant="outlined" sx={{ fontWeight: 'bold' }} />;
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
    } catch (err) {
      setError('Не удалось загрузить смету.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!smetaId || !nextStatus) return;
    try {
      await updateSmetaStatus(Number(smetaId), nextStatus);
      await loadSmeta();
    } catch (err: any) {
      setError(`Ошибка: ${err.response?.data?.detail || err.message}`);
    } finally {
      setDialogOpen(false);
      setNextStatus(null);
    }
  };

  const handleExport = async () => {
    if (!smetaId) return;
    try {
      await exportSmetaToExcel(Number(smetaId));
    } catch { setError('Ошибка экспорта Excel.'); }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (window.confirm('Удалить позицию?')) {
      try {
        await deleteItem(itemId);
        loadSmeta();
      } catch { setError('Ошибка удаления'); }
    }
  };

  const openConfirmDialog = (status: PlanStatus) => {
    setNextStatus(status);
    setDialogOpen(true);
  };

  const isLocked = smeta?.status === PlanStatus.APPROVED;

  // ИСПРАВЛЕНИЕ: Добавлены проверки на null/undefined (?? 0) для устранения ошибки TS18048
  const safeTotal = smeta?.total_amount ?? 0;
  const safeKtpAmount = smeta?.ktp_amount ?? 0;

  const currentKtp = safeTotal > 0
    ? ((safeKtpAmount / safeTotal) * 100).toFixed(2)
    : '0.00';

  const currentImport = safeTotal > 0
    ? (((safeTotal - safeKtpAmount) / safeTotal) * 100).toFixed(2)
    : '0.00';

  if (loading) return <><Header /><Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box></>;
  if (error) return <><Header /><Box sx={{ p: 4 }}><Alert severity="error">{error}</Alert></Box></>;
  if (!smeta) return <><Header /><Box sx={{ p: 4 }}><Alert severity="info">Нет данных</Alert></Box></>;

  return (
    <>
      <Header />
      <Container maxWidth={false} sx={{ py: 4, px: { xs: 2, md: 4 } }}>
        <Paper sx={{ p: 3, mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Stack direction="row" spacing={2} alignItems="center" mb={1}>
              <Typography variant="h4" fontWeight="bold">
                {t('smeta_form_title', { year: smeta.year })}
              </Typography>
              <StatusChip status={smeta.status} />
            </Stack>
            <Typography variant="body2" color="text.secondary">ID сметы: {smeta.id}</Typography>
          </Box>

          <Stack direction="row" spacing={2}>
             {smeta.status !== PlanStatus.DRAFT && (
                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport}>
                   Excel
                </Button>
             )}
             {smeta.status === PlanStatus.DRAFT && (
                <Button variant="contained" color="warning" onClick={() => openConfirmDialog(PlanStatus.PRE_APPROVED)}>
                   Предварительно утвердить
                </Button>
             )}
             {smeta.status === PlanStatus.PRE_APPROVED && (
                <Button variant="contained" color="success" startIcon={<LockIcon />} onClick={() => openConfirmDialog(PlanStatus.APPROVED)}>
                   Окончательно утвердить
                </Button>
             )}
          </Stack>
        </Paper>

        <Box sx={{ width: '100%' }}>
          {smeta.status === PlanStatus.DRAFT && (
            <StatsSection
              title="Текущие показатели (Real-time)"
              ktp={currentKtp}
              importPerc={currentImport}
              total={safeTotal}
              variant="current"
            />
          )}

          {smeta.status === PlanStatus.PRE_APPROVED && (
            <>
              <StatsSection
                title="Текущие показатели (Real-time)"
                ktp={currentKtp}
                importPerc={currentImport}
                total={safeTotal}
                variant="current"
              />
              <StatsSection
                title="Предварительно утвержденный план"
                ktp={smeta.pre_approved_ktp_percentage || '0'}
                importPerc={smeta.pre_approved_import_percentage || '0'}
                total={smeta.pre_approved_total_amount || 0}
                variant="pre_approved"
              />
            </>
          )}

          {smeta.status === PlanStatus.APPROVED && (
            <>
              <StatsSection
                title="Предварительно утвержденный план"
                ktp={smeta.pre_approved_ktp_percentage || '0'}
                importPerc={smeta.pre_approved_import_percentage || '0'}
                total={smeta.pre_approved_total_amount || 0}
                variant="pre_approved"
              />
              <StatsSection
                title="Утвержденный бюджет"
                ktp={smeta.final_ktp_percentage || '0'}
                importPerc={smeta.final_import_percentage || '0'}
                total={smeta.final_total_amount || 0}
                variant="final"
              />
            </>
          )}
        </Box>

        <Box sx={{ mt: 5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} px={2}>
            <Typography variant="h5" fontWeight="500">
              {t('smeta_items_title')} ({smeta.items.length})
            </Typography>
            {!isLocked && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate(`/plans/${smetaId}/items/new`)}
              >
                {t('add_item')}
              </Button>
            )}
          </Stack>

          <Paper sx={{ width: '100%', overflow: 'hidden', mb: 4 }}>
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="5%">№</TableCell>
                    <TableCell width="35%">{t('item_name')}</TableCell>
                    <TableCell width="10%">КТП</TableCell>
                    <TableCell width="10%" align="right">{t('item_quantity')}</TableCell>
                    <TableCell width="15%" align="right">{t('item_price')}</TableCell>
                    <TableCell width="15%" align="right">{t('smeta_amount')}</TableCell>
                    {!isLocked && <TableCell width="10%" align="center">{t('actions')}</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {smeta.items.map((item: SmetaItem) => (
                    <TableRow key={item.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 }, backgroundColor: item.is_ktp ? '#f0f9f0' : 'inherit' }}>
                      <TableCell>{item.item_number}</TableCell>
                      <TableCell>{item.enstru.name_ru}</TableCell>
                      <TableCell>
                         {item.is_ktp ?
                            <Chip label="Да" color="success" size="small" variant="outlined" /> :
                            <Typography variant="caption" color="text.secondary">Нет</Typography>
                         }
                      </TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">{new Intl.NumberFormat('ru-RU').format(item.price_per_unit)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{new Intl.NumberFormat('ru-RU').format(item.total_amount)}</TableCell>
                      {!isLocked && (
                        <TableCell align="center">
                          <Stack direction="row" justifyContent="center">
                            <IconButton size="small" onClick={() => navigate(`/items/${item.id}/edit`)} color="primary">
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" onClick={() => handleDeleteItem(item.id)} color="error">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {smeta.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                        <Typography color="text.secondary">В смете пока нет позиций</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>

      </Container>

      <ConfirmDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleStatusChange}
        title="Подтверждение смены статуса"
      >
        Вы действительно хотите изменить статус этой сметы? Это действие может ограничить редактирование.
      </ConfirmDialog>
    </>
  );
}