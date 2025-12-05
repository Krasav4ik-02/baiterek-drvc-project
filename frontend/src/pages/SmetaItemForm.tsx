import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Button, Typography, Paper, CircularProgress, Alert, Grid, TextField,
  Autocomplete, Stack, FormControlLabel, Checkbox, Divider
} from '@mui/material';
import { Calculate as CalculateIcon } from '@mui/icons-material';
import { useTranslation } from '../i18n/index.tsx';
import Header from '../components/Header';
import { 
    getSmetaItemEditData, updateItem, addItemToSmeta,
    getEnstru, getKato, getCostItems, getSourceFunding, getAgsk, getMkei, checkKtp
} from '../services/api';
import type { 
    SmetaItem, SmetaItemPayload,
    Enstru, Kato, CostItem, SourceFunding, Agsk, Mkei
} from '../services/api';
import { debounce } from 'lodash';

// --- Основной компонент ---
export default function SmetaItemForm() {
  const { smetaId, itemId } = useParams<{ smetaId: string; itemId: string }>();
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const isEditMode = !!itemId;

  // --- Состояния ---
  const [formData, setFormData] = useState<Record<string, any>>({
    enstru: null, unit: null, expense_item: null, funding_source: null,
    agsk: null, kato_purchase: null, kato_delivery: null,
    quantity: 0, price_per_unit: 0, is_ktp: false, is_resident: false, ktp_applicable: false,
  });
  const [options, setOptions] = useState<Record<string, any[]>>({
    enstru: [], kato: [], agsk: [], costItem: [], sourceFunding: [], mkei: [],
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEnstruSelected, setEnstruSelected] = useState(isEditMode);

  // --- Загрузка данных ---
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const staticLookups = await Promise.all([ getMkei(), getCostItems(), getSourceFunding() ]);
        
        if (isEditMode) {
          const { item } = await getSmetaItemEditData(Number(itemId));
          setFormData(item); // Сразу помещаем весь объект item в форму
          setEnstruSelected(true);
        }
        setOptions(prev => ({ ...prev, mkei: staticLookups[0], costItem: staticLookups[1], sourceFunding: staticLookups[2] }));
      } catch (err) { setError('Ошибка загрузки данных.'); } 
      finally { setLoading(false); }
    };
    loadInitialData();
  }, [itemId]);

  // --- Динамический поиск ---
  const debouncedFetch = useMemo(() => 
    debounce(async (query: string, fetcher: (q: string) => Promise<any[]>, key: keyof typeof options) => {
      try {
        const data = await fetcher(query);
        setOptions(prev => ({ ...prev, [key]: data }));
      } catch (err) { console.error(`Ошибка загрузки ${key}`); }
    }, 500), []);

  // --- Обработчики ---
  const handleEnstruSelect = async (value: Enstru | null) => {
    if (value) {
      let isKtp = false;
      try {
        const ktpStatus = await checkKtp(value.code);
        if (ktpStatus.is_ktp) {
          isKtp = true;
        }
      } catch {}

      setFormData({ 
        enstru: value, 
        is_ktp: isKtp, // Устанавливаем значение КТП
        quantity: 0, 
        price_per_unit: 0,
      });
      setEnstruSelected(true);
    } else {
      setFormData({});
      setEnstruSelected(false);
    }
  };

  const handleSave = async () => {
    try {
      const payload: SmetaItemPayload = {
        trucode: formData.enstru?.code,
        unit_id: formData.unit?.id,
        expense_item_id: formData.expense_item?.id,
        funding_source_id: formData.funding_source?.id,
        agsk_id: formData.agsk?.code,
        kato_purchase_id: formData.kato_purchase?.id,
        kato_delivery_id: formData.kato_delivery?.id,
        additional_specs: formData.additional_specs,
        quantity: Number(formData.quantity) || 0,
        price_per_unit: Number(formData.price_per_unit) || 0,
        is_ktp: formData.is_ktp || false,
        is_resident: formData.is_resident || false,
        ktp_applicable: formData.ktp_applicable || false,
      };

      if (!payload.trucode || !payload.expense_item_id || !payload.funding_source_id) {
        setError("Заполните все обязательные поля (ЕНС ТРУ, Статья затрат, Источник финансирования)");
        return;
      }

      if (isEditMode) {
        await updateItem(Number(itemId), payload);
      } else {
        await addItemToSmeta(Number(smetaId), payload);
      }
      navigate(`/plans/${smetaId || formData.plan_id}`);
    } catch (err) { 
        console.error(err);
        setError('Ошибка при сохранении позиции. Проверьте, все ли обязательные поля заполнены.'); 
    }
  };

  const itemTotal = (Number(formData.quantity) || 0) * (Number(formData.price_per_unit) || 0);

  if (loading) return <><Header /><CircularProgress /></>;
  if (error) return <><Header /><Alert severity="error">{error}</Alert></>;

  return (
    <>
      <Header />
      <Box sx={{ p: 4, maxWidth: 'md', mx: 'auto' }}>
        <Paper sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>{isEditMode ? t('item_form_edit_title') : t('item_form_new_title')}</Typography>
          <Stack spacing={3} sx={{ mt: 3 }}>
            <Autocomplete options={options.enstru || []} isOptionEqualToValue={(o, v) => o.id === v.id} getOptionLabel={(o) => `${o.code} - ${lang === 'ru' ? o.name_ru : o.name_kz}`} onInputChange={(_, v) => debouncedFetch(v, getEnstru, 'enstru')} onChange={(_, v) => handleEnstruSelect(v)} value={formData.enstru || null} renderInput={(params) => <TextField {...params} label={t('enstru_label')} />} />

            {isEnstruSelected && (
              <>
                <Divider />
                <TextField label={t('need_type')} value={formData.enstru?.type_ru || ''} InputProps={{ readOnly: true }} variant="filled" />
                <TextField label={t('enstru_name_label')} value={formData.enstru?.name_ru || ''} InputProps={{ readOnly: true }} variant="filled" />
                <TextField label={t('enstru_specs_label')} value={formData.enstru?.specs_ru || ''} InputProps={{ readOnly: true }} variant="filled" />
                <TextField label={t('additional_specs')} multiline rows={2} value={formData.additional_specs || ''} onChange={e => setFormData({ ...formData, additional_specs: e.target.value })} />
                
                <Divider />
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}><Autocomplete options={options.mkei || []} isOptionEqualToValue={(o, v) => o.id === v.id} getOptionLabel={(o) => lang === 'ru' ? o.name_ru : o.name_kz} onChange={(_, v) => setFormData({...formData, unit: v})} value={formData.unit || null} renderInput={(params) => <TextField {...params} label={t('item_unit')} required />} /></Grid>
                    <Grid item xs={12} sm={4}><TextField label={t('item_quantity')} type="number" required fullWidth value={formData.quantity || ''} onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })} /></Grid>
                    <Grid item xs={12} sm={4}><TextField label={t('item_price')} type="number" required fullWidth value={formData.price_per_unit || ''} onChange={e => setFormData({ ...formData, price_per_unit: Number(e.target.value) })} /></Grid>
                </Grid>
                <TextField label={t('smeta_amount')} value={itemTotal.toLocaleString('ru-RU', {style: 'currency', currency: 'KZT'})} fullWidth InputProps={{ readOnly: true }} sx={{ bgcolor: '#f5f5f5' }} variant="filled" />

                <Divider />
                <Autocomplete options={options.agsk || []} isOptionEqualToValue={(o, v) => o.id === v.id} getOptionLabel={(o) => `${o.code} - ${o.name_ru}`} onInputChange={(_, v) => debouncedFetch(v, getAgsk, 'agsk')} onChange={(_, v) => setFormData({...formData, agsk: v})} value={formData.agsk || null} renderInput={(params) => <TextField {...params} label={t('agsk_3')} />} />
                <Autocomplete options={options.costItem || []} isOptionEqualToValue={(o, v) => o.id === v.id} getOptionLabel={(o) => lang === 'ru' ? o.name_ru : o.name_kz} onChange={(_, v) => setFormData({...formData, expense_item: v})} value={formData.expense_item || null} renderInput={(params) => <TextField {...params} label={t('expense_item')} required />} />
                <Autocomplete options={options.sourceFunding || []} isOptionEqualToValue={(o, v) => o.id === v.id} getOptionLabel={(o) => lang === 'ru' ? o.name_ru : o.name_kz} onChange={(_, v) => setFormData({...formData, funding_source: v})} value={formData.funding_source || null} renderInput={(params) => <TextField {...params} label={t('funding_source')} required />} />
                <Grid container spacing={2}>
                  <Grid item xs={6}><Autocomplete options={options.kato || []} isOptionEqualToValue={(o, v) => o.id === v.id} getOptionLabel={(o) => `${o.code} - ${lang === 'ru' ? o.name_ru : o.name_kz}`} onInputChange={(_, v) => debouncedFetch(v, getKato, 'kato')} onChange={(_, v) => setFormData({...formData, kato_purchase: v})} value={formData.kato_purchase || null} renderInput={(params) => <TextField {...params} label={t('kato_purchase')} />} /></Grid>
                  <Grid item xs={6}><Autocomplete options={options.kato || []} isOptionEqualToValue={(o, v) => o.id === v.id} getOptionLabel={(o) => `${o.code} - ${lang === 'ru' ? o.name_ru : o.name_kz}`} onInputChange={(_, v) => debouncedFetch(v, getKato, 'kato')} onChange={(_, v) => setFormData({...formData, kato_delivery: v})} value={formData.kato_delivery || null} renderInput={(params) => <TextField {...params} label={t('kato_delivery')} />} /></Grid>
                </Grid>
                
                {formData.enstru?.type_ru === 'Товар' && (
                  <Stack>
                    <FormControlLabel control={<Checkbox checked={formData.is_ktp || false} disabled />} label={t('is_ktp_label')} />
                    <FormControlLabel control={<Checkbox checked={formData.ktp_applicable || false} onChange={e => setFormData({ ...formData, ktp_applicable: e.target.checked })} />} label={t('ktp_applicable_label')} />
                  </Stack>
                )}
                {(formData.enstru?.type_ru === 'Работа' || formData.enstru?.type_ru === 'Услуга') && (
                  <FormControlLabel control={<Checkbox checked={formData.is_resident || false} onChange={e => setFormData({ ...formData, is_resident: e.target.checked })} />} label={t('is_resident_label')} />
                )}
                
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 2 }}>
                    <Button variant="outlined" color="secondary" onClick={() => navigate(`/plans/${smetaId || formData.plan_id}`)}>{t('cancel')}</Button>
                    <Button variant="contained" onClick={handleSave}>{t('save')}</Button>
                </Box>
              </>
            )}
          </Stack>
        </Paper>
      </Box>
    </>
  );
}
