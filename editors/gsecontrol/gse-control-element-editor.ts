/* eslint-disable import/no-extraneous-dependencies */
import { css, html, LitElement, TemplateResult } from 'lit';
import {
  customElement,
  property,
  query,
  queryAll,
  state,
} from 'lit/decorators.js';

import '@material/mwc-formfield';
import '@material/mwc-checkbox';
import type { Checkbox } from '@material/mwc-checkbox';

import { newEditEvent } from '@openscd/open-scd-core';
import {
  changeGSEContent,
  ChangeGSEContentOptions,
  updateGSEControl,
} from '@openenergytools/scl-lib';

import '../../foundation/components/scl-checkbox.js';
import '../../foundation/components/scl-select.js';
import '../../foundation/components/scl-textfield.js';
import type { SclCheckbox } from '../../foundation/components/scl-checkbox.js';
import type { SclSelect } from '../../foundation/components/scl-select.js';
import type { SclTextfield } from '../../foundation/components/scl-textfield.js';

import {
  maxLength,
  patterns,
  typeNullable,
  typePattern,
} from '../../foundation/pattern.js';
import { identity } from '../../foundation/identities/identity.js';
import { checkGSEDiff } from '../../foundation/utils/gse.js';

@customElement('gse-control-element-editor')
export class GseControlElementEditor extends LitElement {
  /** The document being edited as provided to plugins by [[`OpenSCD`]]. */
  @property({ attribute: false })
  doc!: XMLDocument;

  /** The element being edited as provided to plugins by [[`OpenSCD`]]. */
  @property({ attribute: false })
  element!: Element;

  /** SCL change indicator */
  @property({ type: Number })
  editCount = 0;

  @property({ attribute: false })
  get gSE(): Element | null | undefined {
    const cbName = this.element.getAttribute('name');
    const iedName = this.element.closest('IED')?.getAttribute('name');
    const apName = this.element.closest('AccessPoint')?.getAttribute('name');
    const ldInst = this.element.closest('LDevice')?.getAttribute('inst');

    return this.element.ownerDocument.querySelector(
      `:root > Communication > SubNetwork > ` +
        `ConnectedAP[iedName="${iedName}"][apName="${apName}"] > ` +
        `GSE[ldInst="${ldInst}"][cbName="${cbName}"]`
    );
  }

  @state()
  private gSEdiff = false;

  @state()
  private gSEControlDiff = false;

  private onGSEControlInputChange(): void {
    if (
      Array.from(this.gSEControlInputs ?? []).some(
        input => !input.checkValidity()
      )
    ) {
      this.gSEControlDiff = false;
      return;
    }

    const gSEControlAttrs: Record<string, string | null> = {};
    for (const input of this.gSEControlInputs ?? [])
      gSEControlAttrs[input.label] = input.maybeValue;

    this.gSEControlDiff = Array.from(this.gSEControlInputs ?? []).some(
      input => this.element?.getAttribute(input.label) !== input.maybeValue
    );
  }

  private saveGSEControlChanges(): void {
    if (!this.element) return;

    const gSEControlAttrs: Record<string, string | null> = {};
    for (const input of this.gSEControlInputs ?? [])
      if (this.element?.getAttribute(input.label) !== input.maybeValue)
        gSEControlAttrs[input.label] = input.maybeValue;

    this.dispatchEvent(
      newEditEvent(
        updateGSEControl({
          element: this.element,
          attributes: gSEControlAttrs,
        })
      )
    );

    this.onGSEControlInputChange();
  }

  private onGSEInputChange(): void {
    if (
      Array.from(this.gSEInputs ?? []).some(input => !input.checkValidity())
    ) {
      this.gSEdiff = false;
      return;
    }

    const gSEAttrs: Record<string, string | null> = {};
    for (const input of this.gSEInputs ?? [])
      gSEAttrs[input.label] = input.maybeValue;

    this.gSEdiff = checkGSEDiff(this.gSE!, gSEAttrs, this.instType?.checked);
  }

  private saveGSEChanges(): void {
    if (!this.gSE) return;

    const options: ChangeGSEContentOptions = { address: {}, timing: {} };
    for (const input of this.gSEInputs ?? []) {
      if (input.label === 'MAC-Address' && input.maybeValue)
        options.address!.mac = input.maybeValue;
      if (input.label === 'APPID' && input.maybeValue)
        options.address!.appId = input.maybeValue;
      if (input.label === 'VLAN-ID' && input.maybeValue)
        options.address!.vlanId = input.maybeValue;
      if (input.label === 'VLAN-PRIORITY' && input.maybeValue)
        options.address!.vlanPriority = input.maybeValue;
      if (input.label === 'MinTime' && input.maybeValue)
        options.timing!.MinTime = input.maybeValue;
      if (input.label === 'MaxTime' && input.maybeValue)
        options.timing!.MaxTime = input.maybeValue;
    }

    if (this.instType?.checked === true) options.address!.instType = true;
    else if (this.instType?.checked === false)
      options.address!.instType = false;

    this.dispatchEvent(newEditEvent(changeGSEContent(this.gSE, options)));

    this.onGSEInputChange();
  }

  @queryAll('.content.gse > scl-textfield') gSEInputs?: SclTextfield[];

  @queryAll(
    '.content.gsecontrol > scl-textfield, .content.gsecontrol > scl-select, .content.gsecontrol > scl-checkbox'
  )
  gSEControlInputs?: (SclTextfield | SclSelect | SclCheckbox)[];

  @query('#instType') instType?: Checkbox;

  private renderGseContent(): TemplateResult {
    const { gSE } = this;
    if (!gSE)
      return html`<div class="content">
        <h3>
          <div>Communication Settings (GSE)</div>
          <div class="headersubtitle">No connection to SubNetwork</div>
        </h3>
      </div>`;

    const minTime = gSE.querySelector('MinTime')?.innerHTML.trim() ?? null;
    const maxTime = gSE.querySelector('MaxTime')?.innerHTML.trim() ?? null;

    const hasInstType = Array.from(gSE.querySelectorAll('Address > P')).some(
      pType => pType.getAttribute('xsi:type')
    );

    const attributes: Record<string, string | null> = {};

    ['MAC-Address', 'APPID', 'VLAN-ID', 'VLAN-PRIORITY'].forEach(key => {
      if (!attributes[key])
        attributes[key] =
          gSE.querySelector(`Address > P[type="${key}"]`)?.innerHTML.trim() ??
          null;
    });

    return html`<div class="content gse">
      <h3>Communication Settings (GSE)</h3>
      <mwc-formfield label="connectedap.wizard.addschemainsttype"
        ><mwc-checkbox
          id="instType"
          ?checked="${hasInstType}"
          @change=${this.onGSEInputChange}
        ></mwc-checkbox></mwc-formfield
      >${Object.entries(attributes).map(
        ([key, value]) =>
          html`<scl-textfield
            label="${key}"
            .maybeValue=${value}
            pattern="${typePattern[key]!}"
            required
            @input=${this.onGSEInputChange}
            ?nullable=${typeNullable[key]}
          ></scl-textfield>`
      )}<scl-textfield
        label="MinTime"
        .maybeValue=${minTime}
        nullable
        suffix="ms"
        type="number"
        @input=${this.onGSEInputChange}
      ></scl-textfield
      ><scl-textfield
        label="MaxTime"
        .maybeValue=${maxTime}
        nullable
        suffix="ms"
        type="number"
        @input=${this.onGSEInputChange}
      ></scl-textfield>
      <mwc-button
        class="save"
        label="save"
        icon="save"
        ?disabled=${!this.gSEdiff}
        @click=${() => this.saveGSEChanges()}
      ></mwc-button>
    </div>`;
  }

  private renderGseControlContent(): TemplateResult {
    const [name, desc, type, appID, fixedOffs, securityEnabled] = [
      'name',
      'desc',
      'type',
      'appID',
      'fixedOffs',
      'securityEnabled',
    ].map(attr => this.element?.getAttribute(attr));

    const reservedGseControlNames = Array.from(
      this.element.parentElement?.querySelectorAll('GSEControl') ?? []
    )
      .map(gseControl => gseControl.getAttribute('name')!)
      .filter(
        gseControlName => gseControlName !== this.element.getAttribute('name')
      );

    return html`<div class="content gsecontrol">
      <scl-textfield
        label="name"
        .maybeValue=${name}
        helper="scl.name"
        required
        validationMessage="textfield.required"
        pattern="${patterns.asciName}"
        maxLength="${maxLength.cbName}"
        .reservedValues=${reservedGseControlNames}
        dialogInitialFocus
        @input=${this.onGSEControlInputChange}
      ></scl-textfield>
      <scl-textfield
        label="desc"
        .maybeValue=${desc}
        nullable
        helper="scl.desc"
        @input=${this.onGSEControlInputChange}
      ></scl-textfield>
      <scl-select
        label="type"
        .maybeValue=${type}
        helper="scl.type"
        nullable
        required
        @selected=${this.onGSEControlInputChange}
        >${['GOOSE', 'GSSE'].map(
          gseControlType =>
            html`<mwc-list-item value="${gseControlType}"
              >${gseControlType}</mwc-list-item
            >`
        )}</scl-select
      >
      <scl-textfield
        label="appID"
        .maybeValue=${appID}
        helper="scl.id"
        required
        validationMessage="textfield.nonempty"
        @input=${this.onGSEControlInputChange}
      ></scl-textfield>
      <scl-checkbox
        label="fixedOffs"
        .maybeValue=${fixedOffs}
        nullable
        helper="scl.fixedOffs"
        @input=${this.onGSEControlInputChange}
      ></scl-checkbox>
      <scl-select
        label="securityEnabled"
        .maybeValue=${securityEnabled}
        nullable
        required
        helper="scl.securityEnable"
        @selected=${this.onGSEControlInputChange}
        >${['None', 'Signature', 'SignatureAndEncryption'].map(
          securityType =>
            html`<mwc-list-item value="${securityType}"
              >${securityType}</mwc-list-item
            >`
        )}</scl-select
      >
      <mwc-button
        class="save"
        label="save"
        icon="save"
        ?disabled=${!this.gSEControlDiff}
        @click=${() => this.saveGSEControlChanges()}
      ></mwc-button>
    </div>`;
  }

  render(): TemplateResult {
    return html`<h2 style="display: flex;">
        <div style="flex:auto">
          <div>GSEControl</div>
          <div class="headersubtitle">${identity(this.element)}</div>
        </div>
      </h2>
      <div class="parentcontent">
        ${this.renderGseControlContent()}${this.renderGseContent()}
      </div>`;
  }

  static styles = css`
    .parentcontent {
      display: grid;
      grid-gap: 12px;
      box-sizing: border-box;
      grid-template-columns: repeat(auto-fit, minmax(316px, auto));
    }

    .content {
      display: flex;
      flex-direction: column;
      border-left: thick solid var(--mdc-theme-on-primary);
    }

    .content > * {
      display: block;
      margin: 4px 8px 16px;
    }

    .save {
      align-self: flex-end;
    }

    h2,
    h3 {
      color: var(--mdc-theme-on-surface);
      font-family: 'Roboto', sans-serif;
      font-weight: 300;
      margin: 4px 8px 16px;
      padding-left: 0.3em;
    }

    .headersubtitle {
      font-size: 16px;
      font-weight: 200;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    *[iconTrailing='search'] {
      --mdc-shape-small: 28px;
    }

    @media (max-width: 950px) {
      .content {
        border-left: 0px solid var(--mdc-theme-on-primary);
      }
    }
  `;
}
