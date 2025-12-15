// frontend/src/pages/SmetaItemForm.tsx
import {useEffect, useState, useMemo} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {
    Box, Button, Typography, Paper, CircularProgress, Alert, Grid, TextField,
    Autocomplete, Stack, FormControlLabel, Checkbox, Divider
} from '@mui/material';
import {useTranslation} from '../i18n/index.tsx';
import Header from '../components/Header';
// import KatoSelect from '../components/KatoSelect'; // Удаляем импорт старого KatoSelect
import KatoModalSelect from '../components/KatoModalSelect'; // Импортируем новый KatoModalSelect
import {
    getSmetaById, getSmetaItemEditData, updateItem, addItemToSmeta,
    getEnstru, getCostItems, getSourceFunding, getAgsk, getMkei, checkKtp, PlanStatus
} from '../services/api';
import type {
    SmetaItemPayload, Enstru, Kato, CostItem, SourceFunding, Agsk, Mkei
} from '../services/api';
import {debounce} from 'lodash';

// --- Основной компонент ---
export default function SmetaItemForm() {
    const {smetaId, itemId} = useParams<{ smetaId: string; itemId: string }>();
    const navigate = useNavigate();
    const {t, lang} = useTranslation();
    const isEditMode = !!itemId;

    // --- Состояния ---
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [options, setOptions] = useState<Record<string, any[]>>({
        enstru: [], agsk: [], costItem: [], sourceFunding: [], mkei: [],
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isFullyLocked, setIsFullyLocked] = useState(false);
    const [isEnstruSelected, setEnstruSelected] = useState(isEditMode);

    // Состояния для модальных окон КАТО
    const [isKatoPurchaseModalOpen, setIsKatoPurchaseModalOpen] = useState(false);
    const [isKatoDeliveryModalOpen, setIsKatoDeliveryModalOpen] = useState(false);


    // --- Загрузка данных ---
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);
                const staticLookups = await Promise.all([getCostItems(), getSourceFunding()]);
                setOptions(prev => ({
                    ...prev,
                    costItem: staticLookups[0],
                    sourceFunding: staticLookups[1]
                }));

                let parentPlanId: number | null = smetaId ? Number(smetaId) : null;

                if (isEditMode && itemId) {
                    const {item} = await getSmetaItemEditData(Number(itemId));
                    setFormData(item);
                    setEnstruSelected(true);
                    parentPlanId = item.plan_id;
                }

                if (parentPlanId) {
                    const parentSmeta = await getSmetaById(parentPlanId);
                    if (parentSmeta.status === PlanStatus.APPROVED) {
                        setIsFullyLocked(true);
                    }
                }
            } catch (err) {
                setError('Ошибка загрузки данных.');
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [itemId, smetaId, isEditMode]);

    // --- Динамический поиск ---
    const debouncedFetch = useMemo(() =>
        debounce(async (query: string, fetcher: (q: string) => Promise<any[]>, key: keyof typeof options) => {
            if (query.length < 2) return;
            try {
                const data = await fetcher(query);
                setOptions(prev => ({...prev, [key]: data}));
            } catch (err) {
                console.error(`Ошибка загрузки ${key}`);
            }
        }, 500), []);

    // --- Обработчики ---
    const handleEnstruSelect = async (value: Enstru | null) => {
        if (value) {
            const ktpStatus = await checkKtp(value.code).catch(() => ({is_ktp: false}));
            setFormData({
                enstru: value,
                is_ktp: ktpStatus.is_ktp,
                quantity: 0, price_per_unit: 0,
            });
            setEnstruSelected(true);
        } else {
            setFormData({});
            setEnstruSelected(false);
        }
    };

    const handleSave = async () => {
        if (isFullyLocked) return;
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

            const targetPlanId = smetaId || formData.plan_id;
            if (isEditMode) {
                await updateItem(Number(itemId), payload);
            } else {
                await addItemToSmeta(Number(smetaId), payload);
            }
            navigate(`/plans/${targetPlanId}`);
        } catch (err) {
            const apiError = err.response?.data?.detail || 'Проверьте, все ли обязательные поля заполнены.';
            setError(`Ошибка при сохранении: ${apiError}`);
        }
    };

    const itemTotal = (Number(formData.quantity) || 0) * (Number(formData.price_per_unit) || 0);

    if (loading) return <><Header/><CircularProgress/></>;

    return (
        <>
            <Header/>
            <Box sx={{p: 4, maxWidth: 'lg', mx: 'auto'}}>
                <Paper sx={{p: 5}}>
                    <Typography variant="h5"
                                gutterBottom>{isEditMode ? t('item_form_edit_title') : t('item_form_new_title')}</Typography>

                    {error && <Alert severity="error" sx={{mb: 2}}>{error}</Alert>}
                    {isFullyLocked &&
                        <Alert severity="warning" sx={{mb: 2}}>Форма заблокирована, так как смета находится в финальном
                            статусе "Утверждено".</Alert>}

                    <Stack spacing={3} sx={{mt: 3}}>
                        <Autocomplete disabled={isFullyLocked || (isEditMode && isEnstruSelected)}
                                      options={options.enstru || []} isOptionEqualToValue={(o, v) => o.id === v.id}
                                      getOptionLabel={(o) => `${o.code} - ${lang === 'ru' ? o.name_ru : o.name_kz}`}
                                      onInputChange={(_, v) => debouncedFetch(v, getEnstru, 'enstru')}
                                      onChange={(_, v) => handleEnstruSelect(v)} value={formData.enstru || null}
                                      renderInput={(params) => <TextField {...params} label={t('enstru_label')}/>}
                                      noOptionsText={options.enstru.length === 0 && !formData.enstru ? "Введите как минимум 2 символа" : "Ничего не найдено"}
                        />


                        {isEnstruSelected && (
                            <>
                                <Divider/>
                                <TextField label={t('need_type')} value={formData.enstru?.type_ru || ''}
                                           InputProps={{readOnly: true}} variant="filled"/>
                                <TextField label={t('enstru_name_label')} value={formData.enstru?.name_ru || ''}
                                           InputProps={{readOnly: true}} variant="filled" multiline minRows={2}/>
                                <TextField label={t('enstru_specs_label')} value={formData.enstru?.specs_ru || ''}
                                           InputProps={{readOnly: true}} variant="filled" multiline minRows={3}/>
                                <TextField disabled={isFullyLocked} label={t('additional_specs')} multiline rows={4}
                                           value={formData.additional_specs || ''} onChange={e => setFormData({
                                    ...formData,
                                    additional_specs: e.target.value
                                })}/>

                                <Divider/>
                                <Autocomplete disabled={isFullyLocked} options={options.mkei || []}
                                              isOptionEqualToValue={(o, v) => o.id === v.id}
                                              getOptionLabel={(o) => lang === 'ru' ? o.name_ru : o.name_kz}
                                              onInputChange={(_, v) => debouncedFetch(v, getMkei, 'mkei')}
                                              onChange={(_, v) => setFormData({...formData, unit: v})}
                                              value={formData.unit || null}
                                              renderInput={(params) => <TextField {...params} label={t('item_unit')}
                                                                                  required/>}
                                              noOptionsText={options.mkei.length === 0 ? "Начните вводить текст для поиска (минимум 2 символа)" : "Ничего не найдено"}/>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6}><TextField disabled={isFullyLocked}
                                                                         label={t('item_quantity')} type="number"
                                                                         required fullWidth
                                                                         value={formData.quantity || ''}
                                                                         onChange={e => setFormData({
                                                                             ...formData,
                                                                             quantity: Number(e.target.value)
                                                                         })}/></Grid>
                                    <Grid item xs={12} sm={6}><TextField disabled={isFullyLocked}
                                                                         label={t('item_price')} type="number" required
                                                                         fullWidth value={formData.price_per_unit || ''}
                                                                         onChange={e => setFormData({
                                                                             ...formData,
                                                                             price_per_unit: Number(e.target.value)
                                                                         })}/></Grid>
                                </Grid>
                                <TextField label={t('smeta_amount')} value={itemTotal.toLocaleString('ru-RU', {
                                    style: 'currency',
                                    currency: 'KZT'
                                })} fullWidth InputProps={{readOnly: true}} sx={{bgcolor: '#f5f5f5'}} variant="filled"/>

                                <Divider/>
                                <Autocomplete
                                  disabled={isFullyLocked}
                                  options={options.agsk || []}
                                  isOptionEqualToValue={(o, v) => o.id === v.id}
                                  getOptionLabel={(o) => `Группа: ${o.group}; Код: ${o.code}; ${o.name_ru}`}
                                  onInputChange={(_, v) => debouncedFetch(v, getAgsk, 'agsk')}
                                  onChange={(_, v) => setFormData({...formData, agsk: v})}
                                  value={formData.agsk || null}
                                  renderInput={(params) => <TextField {...params} label={t('agsk_3')} />}
                                  noOptionsText={options.agsk.length === 0 ? "Начните вводить текст для поиска (минимум 2 символа)" : "Ничего не найдено"}
                                />
                                <Autocomplete disabled={isFullyLocked} options={options.costItem || []}
                                              isOptionEqualToValue={(o, v) => o.id === v.id}
                                              getOptionLabel={(o) => lang === 'ru' ? o.name_ru : o.name_kz}
                                              onChange={(_, v) => setFormData({...formData, expense_item: v})}
                                              value={formData.expense_item || null}
                                              renderInput={(params) => <TextField {...params} label={t('expense_item')}
                                                                                  required/>}/>
                                <Autocomplete disabled={isFullyLocked} options={options.sourceFunding || []}
                                              isOptionEqualToValue={(o, v) => o.id === v.id}
                                              getOptionLabel={(o) => lang === 'ru' ? o.name_ru : o.name_kz}
                                              onChange={(_, v) => setFormData({...formData, funding_source: v})}
                                              value={formData.funding_source || null}
                                              renderInput={(params) => <TextField {...params}
                                                                                  label={t('funding_source')}
                                                                                  required/>}/>
                                
                                {/* Заменяем KatoSelect на TextField и Button для KatoPurchase */}
                                <TextField
                                    label={t('kato_purchase')}
                                    value={formData.kato_purchase ? (lang === 'ru' ? formData.kato_purchase.name_ru : formData.kato_purchase.name_kz) : ''}
                                    InputProps={{ readOnly: true }}
                                    onClick={() => !isFullyLocked && setIsKatoPurchaseModalOpen(true)}
                                    disabled={isFullyLocked}
                                    sx={{ cursor: isFullyLocked ? 'not-allowed' : 'pointer' }}
                                />
                                <KatoModalSelect
                                    open={isKatoPurchaseModalOpen}
                                    onClose={() => setIsKatoPurchaseModalOpen(false)}
                                    onSelect={(kato) => setFormData({ ...formData, kato_purchase: kato })}
                                    currentValue={formData.kato_purchase || null}
                                    label={t('select_kato_purchase')}
                                />

                                {/* Заменяем KatoSelect на TextField и Button для KatoDelivery */}
                                <TextField
                                    label={t('kato_delivery')}
                                    value={formData.kato_delivery ? (lang === 'ru' ? formData.kato_delivery.name_ru : formData.kato_delivery.name_kz) : ''}
                                    InputProps={{ readOnly: true }}
                                    onClick={() => !isFullyLocked && setIsKatoDeliveryModalOpen(true)}
                                    disabled={isFullyLocked}
                                    sx={{ cursor: isFullyLocked ? 'not-allowed' : 'pointer' }}
                                />
                                <KatoModalSelect
                                    open={isKatoDeliveryModalOpen}
                                    onClose={() => setIsKatoDeliveryModalOpen(false)}
                                    onSelect={(kato) => setFormData({ ...formData, kato_delivery: kato })}
                                    currentValue={formData.kato_delivery || null}
                                    label={t('select_kato_delivery')}
                                />

                                {formData.enstru?.type_ru === 'Товар' && (
                                    <Stack>
                                        <FormControlLabel
                                            control={<Checkbox checked={formData.is_ktp || false} disabled/>}
                                            label={t('is_ktp_label')}/>
                                        <FormControlLabel control={<Checkbox disabled={isFullyLocked}
                                                                             checked={formData.ktp_applicable || false}
                                                                             onChange={e => setFormData({
                                                                                 ...formData,
                                                                                 ktp_applicable: e.target.checked
                                                                             })}/>} label={t('ktp_applicable_label')}/>
                                    </Stack>
                                )}
                                {(formData.enstru?.type_ru === 'Работа' || formData.enstru?.type_ru === 'Услуга') && (
                                    <FormControlLabel control={<Checkbox disabled={isFullyLocked}
                                                                         checked={formData.is_resident || false}
                                                                         onChange={e => setFormData({
                                                                             ...formData,
                                                                             is_resident: e.target.checked
                                                                         })}/>} label={t('is_resident_label')}/>
                                )}

                                <Divider/>
                                <Box sx={{display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 2}}>
                                    <Button variant="outlined" color="secondary"
                                            onClick={() => navigate(`/plans/${smetaId || formData.plan_id}`)}>{t('cancel')}</Button>
                                    <Button variant="contained" onClick={handleSave}
                                            disabled={isFullyLocked}>{t('save')}</Button>
                                </Box>
                            </>
                        )}
                    </Stack>
                </Paper>
            </Box>
        </>
    );
}