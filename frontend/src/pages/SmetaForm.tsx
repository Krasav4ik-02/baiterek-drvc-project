import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Button, Typography, Paper, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, TableFooter, Grid
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useTranslation } from '../i18n/index.tsx';
import Header from '../components/Header';
import { getSmetaById, deleteItem } from '../services/api';
import type { Smeta, SmetaItem } from '../services/api';

// --- Вспомогательный компонент для отображения статистики ---
const StatsCard = ({ title, value, color }: { title: string, value: string, color: string }) => (
  <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: color, color: '#fff' }}>
    <Typography variant="h6">{value}</Typography>
    <Typography variant="body2">{title}</Typography>
  </Paper>
);

export default function SmetaForm() {
  const { smetaId } = useParams<{ smetaId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [smeta, setSmeta] = useState<Smeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    if (smetaId) {
      loadSmeta();
    } else {
      navigate('/');
    }
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

  const handleAddItem = () => {
    navigate(`/plans/${smetaId}/items/new`);
  };
  
  const handleEditItem = (itemId: number) => {
    navigate(`/items/${itemId}/edit`);
  };

  const handleDeleteItem = async (itemId: number) => {
      if (window.confirm('Вы уверены, что хотите удалить эту позицию?')) {
          try {
              await deleteItem(itemId);
              loadSmeta();
          } catch(err) { setError('Ошибка при удалении'); }
      }
  }

  // --- Расчеты для статистики ---
  const totalAmount = smeta?.total_amount || 0;
  const ktpAmount = smeta?.ktp_amount || 0;
  const nonKtpAmount = smeta?.non_ktp_amount || 0;
  const ktpPercentage = totalAmount > 0 ? ((ktpAmount / totalAmount) * 100).toFixed(2) : '0.00';
  const nonKtpPercentage = totalAmount > 0 ? ((nonKtpAmount / totalAmount) * 100).toFixed(2) : '0.00';

  if (loading) return <><Header /><CircularProgress /></>;
  if (error) return <><Header /><Alert severity="error">{error}</Alert></>;

  return (
    <>
      <Header />
      <Box sx={{ p: 4, maxWidth: 'xl', mx: 'auto' }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          {t('smeta_form_title', { year: smeta?.year || '...' })}
        </Typography>

        {/* Блок со статистикой */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}><StatsCard title="Сумма КТП" value={`${ktpPercentage}%`} color="success.main" /></Grid>
          <Grid item xs={12} sm={4}><StatsCard title="Сумма не-КТП" value={`${nonKtpPercentage}%`} color="warning.main" /></Grid>
          <Grid item xs={12} sm={4}><StatsCard title="Общая сумма" value={new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT' }).format(totalAmount)} color="info.main" /></Grid>
        </Grid>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5">{t('smeta_items_title')}</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddItem}>{t('add_item')}</Button>
        </Box>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('item_number_short')}</TableCell>
                <TableCell>{t('item_name')}</TableCell>
                <TableCell>{t('item_unit')}</TableCell>
                <TableCell>КТП</TableCell>
                <TableCell>{t('item_quantity')}</TableCell>
                <TableCell>{t('item_price')}</TableCell>
                <TableCell>{t('smeta_amount')}</TableCell>
                <TableCell align="right">{t('actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {smeta?.items.map(item => (
                <TableRow key={item.id} sx={{ backgroundColor: item.is_ktp ? '#e8f5e9' : 'inherit' }}>
                    <TableCell>{item.item_number}</TableCell>
                    <TableCell>{item.enstru.name_ru}</TableCell>
                    <TableCell>{item.unit?.name_ru || '-'}</TableCell>
                    <TableCell>{item.is_ktp ? 'Да' : 'Нет'}</TableCell>
                    <TableCell>{String(item.quantity)}</TableCell>
                    <TableCell>{String(item.price_per_unit)}</TableCell>
                    <TableCell>{String(item.total_amount)}</TableCell>
                    <TableCell align="right">
                        <IconButton size="small" onClick={() => handleEditItem(item.id)}><EditIcon /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteItem(item.id)}><DeleteIcon /></IconButton>
                    </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </>
  );
}
