package com.ranieri.qichaminha;

import android.app.Activity;
import android.webkit.WebView;

import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

/** AdMob: premiado (a pessoa escolhe ver e ganha algo) e intersticial (entre partidas, nunca no meio de uma). */
final class Anuncios {
    private final Activity act;
    private final WebView web;
    private RewardedAd premiado;
    private InterstitialAd entre;
    private boolean carregandoP, carregandoI, pronto;

    Anuncios(Activity act, WebView web) {
        this.act = act; this.web = web;
        // shortcut: trata todo mundo como criança (anúncio só de família, sem personalização) porque o jogo atrai crianças;
        // se a receita ficar baixa, perguntar a idade como no Grão (Play Age Signals) e liberar adulto.
        MobileAds.setRequestConfiguration(MobileAds.getRequestConfiguration().toBuilder()
            .setTagForChildDirectedTreatment(RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE)
            .setTagForUnderAgeOfConsent(RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE)
            .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_G).build());
        UserMessagingPlatform.getConsentInformation(act).requestConsentInfoUpdate(act,
            new ConsentRequestParameters.Builder().setTagForUnderAgeOfConsent(true).build(),
            () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(act, e -> inicia()),
            e -> inicia());
    }

    private void inicia() {
        if (!UserMessagingPlatform.getConsentInformation(act).canRequestAds()) return;
        MobileAds.initialize(act, s -> { pronto = true; carregaP(); carregaI(); });
    }

    private void carregaP() {
        if (!pronto || premiado != null || carregandoP) return;
        carregandoP = true;
        act.runOnUiThread(() -> RewardedAd.load(act, BuildConfig.PREMIADO, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override public void onAdLoaded(RewardedAd a) { premiado = a; carregandoP = false; }
            @Override public void onAdFailedToLoad(LoadAdError e) { carregandoP = false; }
        }));
    }
    private void carregaI() {
        if (!pronto || entre != null || carregandoI) return;
        carregandoI = true;
        act.runOnUiThread(() -> InterstitialAd.load(act, BuildConfig.INTERSTICIAL, new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
            @Override public void onAdLoaded(InterstitialAd a) { entre = a; carregandoI = false; }
            @Override public void onAdFailedToLoad(LoadAdError e) { carregandoI = false; }
        }));
    }

    boolean premiadoPronto() { return premiado != null; }

    /** Responde no jogo por window.qiAnuncio(true) se a pessoa assistiu até ganhar. */
    void premiado() {
        act.runOnUiThread(() -> {
            if (premiado == null) { avisa(false); carregaP(); return; }
            RewardedAd a = premiado; premiado = null;
            final boolean[] ganhou = {false};
            a.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override public void onAdDismissedFullScreenContent() { avisa(ganhou[0]); carregaP(); }
                @Override public void onAdFailedToShowFullScreenContent(com.google.android.gms.ads.AdError e) { avisa(false); carregaP(); }
            });
            a.show(act, item -> ganhou[0] = true);
        });
    }

    void intersticial() {
        act.runOnUiThread(() -> {
            if (entre == null) { carregaI(); return; } // sem anúncio pronto: segue sem nada
            InterstitialAd a = entre; entre = null;
            a.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override public void onAdDismissedFullScreenContent() { carregaI(); }
                @Override public void onAdFailedToShowFullScreenContent(com.google.android.gms.ads.AdError e) { carregaI(); }
            });
            a.show(act);
        });
    }

    // Onde a lei pede (Europa), a pessoa precisa poder mudar o consentimento.
    boolean pedePrivacidade() {
        return UserMessagingPlatform.getConsentInformation(act).getPrivacyOptionsRequirementStatus()
            == com.google.android.ump.ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }
    void privacidade() { act.runOnUiThread(() -> UserMessagingPlatform.showPrivacyOptionsForm(act, e -> {})); }

    private void avisa(boolean ok) {
        act.runOnUiThread(() -> web.evaluateJavascript("window.qiAnuncio && window.qiAnuncio(" + ok + ")", null));
    }
}
