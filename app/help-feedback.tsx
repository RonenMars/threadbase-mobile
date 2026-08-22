import React, { useMemo, useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { useTranslation } from 'react-i18next'
import {
  Bug,
  Lightbulb,
  ChatCircleText,
  ClipboardText,
  ShieldCheck,
  Envelope,
  CaretRight,
  Check,
  X,
  Image as ImageIcon,
  PaperPlaneTilt,
} from 'phosphor-react-native'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { DiagnosticsPreview } from '@/components/feedback/DiagnosticsPreview'
import { buildFeedbackDiagnostics } from '@/services/feedback-diagnostics'
import {
  submitFeedback,
  copyReportToClipboard,
  FEEDBACK_PAGE_URL,
  SUPPORT_EMAIL,
} from '@/services/feedback-transport'
import { pickAndPrepareScreenshot } from '@/services/feedback-screenshot'
import { addSafeBreadcrumb } from '@/services/sentry'
import { recordDiagnosticEvent } from '@/services/diagnostic-events'
import type { FeedbackCategory, FeedbackReport, FeedbackAttachment, FeedbackTransportKind } from '@/types/feedback'

const PRIVACY_URL = 'https://threadbase.sh/privacy-policy'
const MIN_DESCRIPTION = 10

type View3 = 'landing' | 'form' | 'success' | 'copyFallback'

/** Generate a client-side report id without Date.now (deterministic-safe). */
// Written out rather than assembled as t(`category.${cat}`) so the keys stay
// visible to `i18next-cli status --unused`. Exhaustive over FeedbackCategory.
const CATEGORY_KEYS = {
  bug: 'category.bug',
  feature: 'category.feature',
  general: 'category.general',
} as const satisfies Record<FeedbackCategory, string>

function makeReportId(): string {
  const rand = Math.floor(Math.random() * 1e9).toString(36)
  return `rep_${rand}`
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function HelpFeedbackScreen() {
  const { t } = useTranslation('feedback')
  const theme = useTheme()
  const isGlass = useIsGlass()
  const router = useRouter()
  const s = useMemo(() => styles(theme), [theme])

  const [view, setView] = useState<View3>('landing')
  const [category, setCategory] = useState<FeedbackCategory>('bug')
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true)
  const [attachment, setAttachment] = useState<FeedbackAttachment | null>(null)
  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [reportId] = useState(makeReportId)
  const [copied, setCopied] = useState(false)
  const [deliveredVia, setDeliveredVia] = useState<FeedbackTransportKind | null>(null)

  const diagnostics = useMemo(() => buildFeedbackDiagnostics(), [])

  const openForm = useCallback((cat: FeedbackCategory) => {
    setCategory(cat)
    setView('form')
    addSafeBreadcrumb('feedback_opened')
    recordDiagnosticEvent('feedback_opened')
  }, [])

  const buildReport = useCallback((): FeedbackReport => ({
    reportId,
    category,
    description: description.trim(),
    email: email.trim() || undefined,
    diagnostics: includeDiagnostics ? diagnostics : undefined,
    attachment: attachment ?? undefined,
  }), [reportId, category, description, email, includeDiagnostics, diagnostics, attachment])

  const handlePickScreenshot = useCallback(async () => {
    try {
      const picked = await pickAndPrepareScreenshot()
      if (picked) setAttachment(picked)
    } catch {
      Alert.alert(t('screenshotError.title'), t('screenshotError.message'))
    }
  }, [t])

  const validate = useCallback((): boolean => {
    let ok = true
    const desc = description.trim()
    if (desc.length === 0) {
      setDescriptionError(t('validation.descriptionRequired'))
      ok = false
    } else if (desc.length < MIN_DESCRIPTION) {
      setDescriptionError(t('validation.descriptionTooShort'))
      ok = false
    } else {
      setDescriptionError(null)
    }
    if (email.trim() && !isValidEmail(email.trim())) {
      setEmailError(t('validation.emailInvalid'))
      ok = false
    } else {
      setEmailError(null)
    }
    return ok
  }, [description, email, t])

  const handleSubmit = useCallback(async () => {
    if (submitting) return // duplicate-submit prevention
    if (!validate()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await submitFeedback(buildReport())
      if (result.ok) {
        addSafeBreadcrumb('feedback_submitted')
        recordDiagnosticEvent('feedback_submitted')
        setDeliveredVia(result.via)
        setView('success')
      } else {
        // No automatic transport succeeded — offer the copy + guide fallback.
        setView('copyFallback')
      }
    } catch {
      setSubmitError(t('error.message'))
    } finally {
      setSubmitting(false)
    }
  }, [submitting, validate, buildReport, t])

  const handleCopyReport = useCallback(async () => {
    const ok = await copyReportToClipboard(buildReport())
    setCopied(ok)
  }, [buildReport])

  const heading =
    category === 'bug'
      ? t('form.bugHeading')
      : category === 'feature'
        ? t('form.featureHeading')
        : t('form.generalHeading')
  const subheading =
    category === 'bug'
      ? t('form.bugSubtitle')
      : category === 'feature'
        ? t('form.featureSubtitle')
        : t('form.generalSubtitle')

  // ---- Success state ----
  if (view === 'success') {
    const deliveryNote =
      deliveredVia === 'sentry'
        ? t('success.viaSentry')
        : deliveredVia === 'email'
          ? t('success.viaEmail')
          : null

    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={s.centered}>
          <View style={s.successIcon}>
            <Check size={32} color={theme.text.success} weight="bold" />
          </View>
          <Text style={s.successTitle}>{t('success.title')}</Text>
          <Text style={s.successMessage}>{t('success.message')}</Text>
          {deliveryNote ? (
            <View style={s.deliveryNote}>
              <PaperPlaneTilt size={14} color={theme.text.secondary} />
              <Text style={s.deliveryNoteText}>{deliveryNote}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[s.primaryBtn, s.primaryBtnWide]}
            onPress={() => setView('landing')}
            accessibilityRole="button"
            accessibilityLabel={t('success.done')}
            testID="feedback-success-done"
          >
            <Text style={s.primaryBtnText}>{t('success.done')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ---- Copy fallback state ----
  if (view === 'copyFallback') {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.heading}>{t('copyFallback.title')}</Text>
          <View style={[s.card, isGlass && s.cardGlass]}>
            <GlassFill />
            <View style={s.stepRow}>
              <Text style={s.stepNum}>1</Text>
              <Text style={s.stepText}>{t('copyFallback.step1')}</Text>
              <TouchableOpacity
                onPress={handleCopyReport}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('copyFallback.copyButton')}
                testID="feedback-copy-report"
              >
                {copied ? (
                  <Check size={22} color={theme.text.success} />
                ) : (
                  <ClipboardText size={22} color={theme.text.accent} />
                )}
              </TouchableOpacity>
            </View>
            {copied ? <Text style={s.copiedNote}>{t('copyFallback.copied')}</Text> : null}
            <View style={s.stepRow}>
              <Text style={s.stepNum}>2</Text>
              <Text style={s.stepText}>{t('copyFallback.step2')}</Text>
            </View>
            <View style={s.stepRow}>
              <Text style={s.stepNum}>3</Text>
              <Text style={s.stepText}>{t('copyFallback.step3')}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => Linking.openURL(FEEDBACK_PAGE_URL)}
            accessibilityRole="button"
            accessibilityLabel={t('copyFallback.openPage')}
            testID="feedback-open-page"
          >
            <Text style={s.primaryBtnText}>{t('copyFallback.openPage')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ---- Landing state ----
  if (view === 'landing') {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.heading}>{t('landing.heading')}</Text>
          <Text style={s.subheading}>{t('landing.subtitle')}</Text>

          <View style={[s.card, isGlass && s.cardGlass]}>
            <GlassFill />
            <LandingRow
              icon={<Bug size={22} color={theme.text.accent} />}
              label={t('landing.reportBug')}
              onPress={() => openForm('bug')}
              testID="feedback-landing-bug"
              theme={theme}
            />
            <LandingRow
              icon={<Lightbulb size={22} color={theme.text.accent} />}
              label={t('landing.suggestFeature')}
              onPress={() => openForm('feature')}
              testID="feedback-landing-feature"
              theme={theme}
            />
            <LandingRow
              icon={<ChatCircleText size={22} color={theme.text.accent} />}
              label={t('landing.generalFeedback')}
              onPress={() => openForm('general')}
              testID="feedback-landing-general"
              theme={theme}
              isLast
            />
          </View>

          <View style={[s.card, isGlass && s.cardGlass]}>
            <GlassFill />
            <LandingRow
              icon={<ClipboardText size={22} color={theme.text.secondary} />}
              label={t('landing.copyDiagnostics')}
              onPress={() => router.push('/diagnostics')}
              testID="feedback-landing-diagnostics"
              theme={theme}
            />
            <LandingRow
              icon={<ShieldCheck size={22} color={theme.text.secondary} />}
              label={t('landing.privacyPolicy')}
              onPress={() => Linking.openURL(PRIVACY_URL)}
              testID="feedback-landing-privacy"
              theme={theme}
            />
            <LandingRow
              icon={<Envelope size={22} color={theme.text.secondary} />}
              label={t('landing.supportEmail')}
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Threadbase%20Support`)}
              testID="feedback-landing-support"
              theme={theme}
              isLast
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ---- Form state ----
  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <KeyboardAwareScrollView contentContainerStyle={s.content} bottomOffset={20}>
        <Text style={s.heading}>{heading}</Text>
        <Text style={s.subheading}>{subheading}</Text>

        {/* Category selector */}
        <Text style={s.fieldLabel}>{t('category.label')}</Text>
        <View style={s.segmented}>
          {(['bug', 'feature', 'general'] as const).map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[s.segmentBtn, category === cat && s.segmentBtnActive]}
              onPress={() => setCategory(cat)}
              accessibilityRole="button"
              accessibilityLabel={t(CATEGORY_KEYS[cat])}
              testID={`feedback-category-${cat}`}
            >
              <Text style={[s.segmentText, category === cat && s.segmentTextActive]}>
                {t(CATEGORY_KEYS[cat])}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Description */}
        <Text style={s.fieldLabel}>{t('form.descriptionLabel')}</Text>
        <TextInput
          style={[s.input, s.multiline, descriptionError && s.inputError]}
          value={description}
          onChangeText={(v) => { setDescription(v); if (descriptionError) setDescriptionError(null) }}
          placeholder={t('form.descriptionPlaceholder')}
          placeholderTextColor={theme.text.secondary}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          testID="feedback-description-input"
        />
        {descriptionError ? <Text style={s.errorText}>{descriptionError}</Text> : null}

        {/* Email */}
        <Text style={s.fieldLabel}>{t('form.emailLabel')}</Text>
        <TextInput
          style={[s.input, emailError && s.inputError]}
          value={email}
          onChangeText={(v) => { setEmail(v); if (emailError) setEmailError(null) }}
          placeholder={t('form.emailPlaceholder')}
          placeholderTextColor={theme.text.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          testID="feedback-email-input"
        />
        {emailError ? <Text style={s.errorText}>{emailError}</Text> : null}

        {/* Screenshot */}
        <Text style={s.fieldLabel}>{t('form.screenshotLabel')}</Text>
        {attachment ? (
          <View style={s.attachmentRow}>
            <Image source={{ uri: attachment.uri }} style={s.thumb} />
            <TouchableOpacity
              style={s.removeBtn}
              onPress={() => setAttachment(null)}
              accessibilityRole="button"
              accessibilityLabel={t('form.removeScreenshot')}
              testID="feedback-remove-screenshot"
            >
              <X size={16} color={theme.text.danger} />
              <Text style={s.removeText}>{t('form.removeScreenshot')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={s.addScreenshotBtn}
            onPress={handlePickScreenshot}
            accessibilityRole="button"
            accessibilityLabel={t('form.addScreenshot')}
            testID="feedback-add-screenshot"
          >
            <ImageIcon size={18} color={theme.text.accent} />
            <Text style={s.addScreenshotText}>{t('form.addScreenshot')}</Text>
          </TouchableOpacity>
        )}
        <Text style={s.helperText}>{t('form.screenshotHelper')}</Text>

        {/* Diagnostics opt-in */}
        <TouchableOpacity
          style={s.checkboxRow}
          onPress={() => setIncludeDiagnostics((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: includeDiagnostics }}
          accessibilityLabel={t('form.includeDiagnostics')}
          testID="feedback-include-diagnostics"
        >
          <View style={[s.checkbox, includeDiagnostics && s.checkboxChecked]}>
            {includeDiagnostics ? <Check size={14} color={theme.text.onAccent} weight="bold" /> : null}
          </View>
          <Text style={s.checkboxLabel}>{t('form.includeDiagnostics')}</Text>
        </TouchableOpacity>
        <Text style={s.helperText}>{t('form.diagnosticsHelper')}</Text>
        {includeDiagnostics ? <DiagnosticsPreview diagnostics={diagnostics} /> : null}

        {submitError ? <Text style={s.errorText}>{submitError}</Text> : null}

        {/* Submit */}
        <TouchableOpacity
          style={[s.primaryBtn, submitting && s.primaryBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={t('form.submit')}
          testID="feedback-submit"
        >
          {submitting ? (
            <View style={s.submittingRow}>
              <ActivityIndicator size="small" color={theme.text.onAccent} />
              <Text style={s.primaryBtnText}>{t('form.sending')}</Text>
            </View>
          ) : (
            <Text style={s.primaryBtnText}>{t('form.submit')}</Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  )
}

function LandingRow({
  icon,
  label,
  onPress,
  testID,
  theme,
  isLast,
}: {
  icon: React.ReactNode
  label: string
  onPress: () => void
  testID: string
  theme: Theme
  isLast?: boolean
}) {
  const s = useMemo(() => styles(theme), [theme])
  return (
    <TouchableOpacity
      style={[s.landingRow, isLast && { borderBottomWidth: 0 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      {icon}
      <Text style={s.landingLabel}>{label}</Text>
      <CaretRight size={18} color={theme.text.secondary} />
    </TouchableOpacity>
  )
}

function styles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
    content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: spacing.sm,
    },
    heading: {
      color: theme.text.primary,
      fontSize: font.xl,
      fontWeight: '700',
      marginTop: spacing.sm,
    },
    subheading: {
      color: theme.text.secondary,
      fontSize: font.base,
      lineHeight: 21,
      marginBottom: spacing.sm,
    },
    card: {
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    cardGlass: { backgroundColor: 'transparent' },
    landingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      minHeight: 52,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    landingLabel: { flex: 1, color: theme.text.primary, fontSize: font.base },
    fieldLabel: {
      color: theme.text.secondary,
      fontSize: font.sm,
      fontWeight: '500',
      marginTop: spacing.sm,
    },
    segmented: {
      flexDirection: 'row',
      backgroundColor: theme.bg.card,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    segmentBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
    segmentBtnActive: { backgroundColor: theme.text.accent },
    segmentText: { color: theme.text.secondary, fontSize: font.sm, fontWeight: '500' },
    segmentTextActive: { color: theme.text.onAccent },
    input: {
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      color: theme.text.primary,
      fontSize: font.base,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: 44,
    },
    multiline: { minHeight: 110 },
    inputError: { borderColor: theme.text.danger },
    errorText: { color: theme.text.danger, fontSize: font.sm },
    helperText: { color: theme.text.secondary, fontSize: font.xs, lineHeight: 16 },
    addScreenshotBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      borderStyle: 'dashed',
      padding: spacing.md,
      minHeight: 44,
      justifyContent: 'center',
    },
    addScreenshotText: { color: theme.text.accent, fontSize: font.base, fontWeight: '500' },
    attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: theme.bg.card },
    removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
    removeText: { color: theme.text.danger, fontSize: font.sm },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
      minHeight: 44,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: { backgroundColor: theme.text.accent, borderColor: theme.text.accent },
    checkboxLabel: { flex: 1, color: theme.text.primary, fontSize: font.base },
    primaryBtn: {
      backgroundColor: theme.text.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      marginTop: spacing.md,
    },
    primaryBtnDisabled: { opacity: 0.6 },
    // primaryBtn has no explicit width so it stretches inside the form/
    // copy-fallback screens' padded ScrollView. The success screen centers its
    // content instead, which shrink-wraps children — without this the button
    // collapses to just the label's width. Used only there.
    primaryBtnWide: { minWidth: 200, paddingHorizontal: spacing.xl },
    primaryBtnText: { color: theme.text.onAccent, fontSize: font.base, fontWeight: '600' },
    submittingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    successIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.bg.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successTitle: { color: theme.text.primary, fontSize: font.lg, fontWeight: '700', marginTop: spacing.sm },
    successMessage: { color: theme.text.secondary, fontSize: font.base, textAlign: 'center', lineHeight: 21 },
    deliveryNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    deliveryNoteText: { color: theme.text.secondary, fontSize: font.xs },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      minHeight: 48,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    stepNum: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.text.accent,
      color: theme.text.onAccent,
      textAlign: 'center',
      lineHeight: 24,
      fontSize: font.sm,
      fontWeight: '700',
      overflow: 'hidden',
    },
    stepText: { flex: 1, color: theme.text.primary, fontSize: font.base },
    copiedNote: { color: theme.text.success, fontSize: font.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  })
}
