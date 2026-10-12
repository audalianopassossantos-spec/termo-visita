/* Gera o PDF do Termo de Visita com bloco de assinatura eletrônica e QR code.
   Depende de jsPDF (window.jspdf.jsPDF) e qrcode-generator (window.qrcode). */
(function (root) {
  'use strict';

  function limpa(s) {
    return String(s == null ? '' : s)
      .replace(/[–—]/g, '-')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/ /g, ' ')
      .replace(/[^\x00-\xFF]/g, '?');
  }

  function fmtDataHora(iso) {
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'medium'
      }) + ' (Brasília)';
    } catch (e) { return String(iso); }
  }

  function desenhaQR(doc, qrcodeLib, texto, x, y, tam) {
    var qr = qrcodeLib(0, 'M');
    qr.addData(texto);
    qr.make();
    var n = qr.getModuleCount();
    var quiet = 2;
    var cel = tam / (n + quiet * 2);
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, tam, tam, 'F');
    doc.setFillColor(0, 0, 0);
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) {
          doc.rect(x + (c + quiet) * cel, y + (r + quiet) * cel, cel + 0.02, cel + 0.02, 'F');
        }
      }
    }
  }

  /* d = { cliente, texto, codigo, hash, assinadoEm, url } */
  function gerar(d, libs) {
    var jsPDF = (libs && libs.jsPDF) || (root.jspdf && root.jspdf.jsPDF);
    var qrcodeLib = (libs && libs.qrcode) || root.qrcode;
    if (!jsPDF || !qrcodeLib) throw new Error('Bibliotecas de PDF/QR não carregadas');

    var doc = new jsPDF({ unit: 'mm', format: 'a4' });
    var W = 210, H = 297, M = 18, LARG = W - M * 2;
    var roxo = [35, 10, 67];

    /* Logomarca em vetor (mesma arte do site): selo roxo com chave + nome */
    function logomarca(x, y, alt) {
      var s = alt / 100; /* arte original em grade 100x100 */
      /* selo */
      doc.setFillColor(roxo[0], roxo[1], roxo[2]);
      doc.roundedRect(x, y, 100 * s, 100 * s, 10 * s, 10 * s, 'F');
      doc.setFillColor(255, 255, 255);
      doc.circle(x + 31 * s, y + 55 * s, 13 * s, 'F');
      doc.setFillColor(roxo[0], roxo[1], roxo[2]);
      doc.circle(x + 31 * s, y + 55 * s, 6 * s, 'F');
      /* haste da chave */
      doc.setFillColor(255, 255, 255);
      var seg = [[40, 0], [6, 6], [-6, 6], [-6, 0], [-4, -5], [-4, 5], [-4, -5], [-4, 5],
                 [-4, 0], [-4, -5], [-4, 5], [-6, 0]].map(function (p) { return [p[0] * s, p[1] * s]; });
      doc.lines(seg, x + 42 * s, y + 49 * s, [1, 1], 'F', true);
      /* nome */
      var tx = x + 100 * s + 3;
      doc.setTextColor(roxo[0], roxo[1], roxo[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('APS', tx, y + 5.6);
      doc.setFontSize(7.6);
      doc.text('Soluções', tx, y + 9.6);
      doc.text('Imobiliárias', tx, y + 13.2);
    }

    function cabecalho() {
      doc.setFillColor(roxo[0], roxo[1], roxo[2]);
      doc.rect(0, 0, W, 26, 'F');
      /* plaquinha branca para a logo aparecer sobre o fundo roxo */
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(M - 3, 3.5, 56, 19, 2.5, 2.5, 'F');
      logomarca(M, 5.7, 14.6);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('Termo de Visita', W - M, 15, { align: 'right' });
      doc.setTextColor(22, 36, 58);
    }

    cabecalho();
    var y = 36;
    var LH = 4.9;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    var linhas = limpa(d.texto).split('\n');
    for (var i = 0; i < linhas.length; i++) {
      var ln = linhas[i];
      var eTitulo = /^(TERMO DE VISITA|IMÓVEIS:|PROPOSTA)/.test(ln);
      var mRot = /^(Cliente|CPF|Endereço|E-mail|Cel|VALOR ANUNCIADO DO IMÓVEL|Corretor\(a\)|Corretor|Imóvel|Valor ofertado|Pagamento|Entrada\/sinal|Entrada|Validade|Condições):\s*/.exec(ln);
      if (ln.trim() === '') { y += LH * 0.6; continue; }
      if (y > H - 22) { doc.addPage(); cabecalho(); y = 36; doc.setFontSize(10); }
      if (mRot) {
        /* rótulo em negrito + valor normal, com quebra de linha alinhada */
        var rot = mRot[0].replace(/\s+$/, '') + ' ';
        doc.setFont('helvetica', 'bold');
        var wRot = doc.getTextWidth(rot) + 1;
        doc.text(rot, M, y);
        doc.setFont('helvetica', 'normal');
        var resto = ln.slice(mRot[0].length);
        var pr = doc.splitTextToSize(resto, LARG - wRot);
        doc.text(pr[0] || '', M + wRot, y);
        y += LH;
        for (var k = 1; k < pr.length; k++) {
          if (y > H - 22) { doc.addPage(); cabecalho(); y = 36; doc.setFontSize(10); }
          doc.text(pr[k], M + wRot, y);
          y += LH;
        }
        continue;
      }
      var partes = doc.splitTextToSize(ln, LARG);
      for (var j = 0; j < partes.length; j++) {
        if (y > H - 22) { doc.addPage(); cabecalho(); y = 36; doc.setFontSize(10); }
        doc.setFont('helvetica', eTitulo ? 'bold' : 'normal');
        doc.text(partes[j], M, y);
        y += LH;
      }
    }

    /* Bloco de assinatura eletrônica */
    var altBloco = 72;
    if (y + altBloco + 6 > H - 18) { doc.addPage(); cabecalho(); y = 36; }
    y += 6;

    doc.setDrawColor(roxo[0], roxo[1], roxo[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, y, LARG, altBloco, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(roxo[0], roxo[1], roxo[2]);
    doc.text('ASSINATURA ELETRÔNICA', M + 5, y + 7);
    doc.setTextColor(22, 36, 58);

    var tx = M + 5, ty = y + 14;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('Assinado por:', tx, ty);
    doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(limpa(d.cliente), 100)[0], tx + 24, ty);

    ty += 6;
    doc.setFont('helvetica', 'normal');
    doc.text('Data e hora:', tx, ty);
    doc.setFont('helvetica', 'bold');
    doc.text(limpa(fmtDataHora(d.assinadoEm)), tx + 24, ty);

    ty += 6;
    doc.setFont('helvetica', 'normal');
    doc.text('Código:', tx, ty);
    doc.setFont('courier', 'bold'); doc.setFontSize(12);
    doc.text(limpa(d.codigo), tx + 24, ty);

    ty += 7;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Hash SHA-256 do termo:', tx, ty);
    doc.setFont('courier', 'normal'); doc.setFontSize(7.5);
    var h = String(d.hash || '');
    doc.text(h.slice(0, 32), tx, ty + 4.5);
    doc.text(h.slice(32), tx, ty + 8.5);

    ty += 15;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    var info = doc.splitTextToSize(
      'Aceite eletrônico (assinatura eletrônica simples) registrado pela APS Soluções Imobiliárias. ' +
      'Para conferir a autenticidade, aponte a câmera para o QR code ou acesse o endereço abaixo.', 108);
    doc.text(info, tx, ty);
    var yUrl = ty + info.length * 3.6 + 3;
    doc.setFont('courier', 'normal'); doc.setFontSize(7.5);
    doc.setTextColor(roxo[0], roxo[1], roxo[2]);
    doc.text(doc.splitTextToSize(limpa(d.url), 108), tx, yUrl);
    doc.setTextColor(22, 36, 58);

    var tamQR = 40;
    desenhaQR(doc, qrcodeLib, d.url, M + LARG - tamQR - 5, y + 11, tamQR);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.text('Verificar autenticidade', M + LARG - tamQR - 5 + tamQR / 2, y + 11 + tamQR + 4, { align: 'center' });

    /* Rodapé em todas as páginas */
    var total = doc.getNumberOfPages();
    for (var p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setDrawColor(221, 216, 230);
      doc.setLineWidth(0.3);
      doc.line(M, H - 14, W - M, H - 14);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.setTextColor(91, 104, 120);
      doc.text('APS Soluções Imobiliárias · CNPJ 43.728.620/0001-54 · Rua Kepler, 608, Loja 1 · Santa Lúcia · Belo Horizonte/MG', M, H - 9.5);
      doc.text(limpa(d.codigo) + ' · página ' + p + ' de ' + total, W - M, H - 9.5, { align: 'right' });
    }

    return doc;
  }

  function nomeArquivo(codigo) {
    return 'Termo-de-Visita-' + String(codigo).replace(/[^A-Za-z0-9-]/g, '') + '.pdf';
  }

  root.APS_PDF = { gerar: gerar, nomeArquivo: nomeArquivo };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.APS_PDF;
})(typeof window !== 'undefined' ? window : globalThis);
