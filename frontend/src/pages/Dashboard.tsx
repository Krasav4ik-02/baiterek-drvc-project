import { useEffect, useState } from 'react';
import { 
  Box, Button, Typography, Paper, CircularProgress, Alert, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.tsx';
import Header from '../components/Header';
import { getSmetas, deleteSmeta, createSmeta } from '../services/api';
import type { Smeta } from '../services/api';

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [smetas, setSmetas] = useState<Smeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [newSmetaYear, setNewSmetaYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadSmetas();
  }, []);

  const loadSmetas = async () => {
    try {
      setLoading(true);
      const data = await getSmetas();
      setSmetas(data);
    } catch (err) {
      setError('Не удалось загрузить сметы закупок.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateDialog = () => {
    setNewSmetaYear(new Date().getFullYear());
    setCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
  };

  const handleCreateSmeta = async () => {
    try {
      const newSmeta = await createSmeta({ year: newSmetaYear });
      handleCloseCreateDialog();
      navigate(`/plans/${newSmeta.id}`);
    } catch (err) {
      setError('Ошибка при создании сметы.');
    }
  };

  const handleDelete = async (smetaId: number) => {
    if (window.confirm('Вы уверены, что хотите удалить эту смету?')) {
      try {
        await deleteSmeta(smetaId);
        setSmetas(smetas.filter(s => s.id !== smetaId));
      } catch (err) {
        setError('Ошибка при удалении сметы.');
      }
    }
  };

  return (
    <>
      <Header />
      <Box sx={{ p: 4, maxWidth: 'lg', mx: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" fontWeight="bold">{t('dashboard_title')}</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateDialog}
          >
            {t('create_plan')}
          </Button>
        </Box>

        {loading && <CircularProgress />}
        {error && <Alert severity="error">{error}</Alert>}

        {!loading && !error && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('smeta_id')}</TableCell>
                  <TableCell>{t('smeta_year')}</TableCell>
                  <TableCell>{t('smeta_amount')}</TableCell>
                  <TableCell align="right">{t('actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {smetas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography color="text.secondary" sx={{ p: 3 }}>{t('no_plans_found')}</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  smetas.map(smeta => (
                    <TableRow key={smeta.id} hover>
                      <TableCell>Смета №{smeta.id}</TableCell>
                      <TableCell>{smeta.year}</TableCell>
                      <TableCell>
                        {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT' }).format(smeta.total_amount)}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => navigate(`/plans/${smeta.id}`)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(smeta.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Dialog open={isCreateDialogOpen} onClose={handleCloseCreateDialog}>
        <DialogTitle>Создать новую смету</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('smeta_year')}
            type="number"
            fullWidth
            variant="standard"
            value={newSmetaYear}
            onChange={(e) => setNewSmetaYear(Number(e.target.value))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateDialog}>{t('cancel')}</Button>
          <Button onClick={handleCreateSmeta}>{t('create_plan')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
